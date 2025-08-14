#!/usr/bin/env python3
import os
import smtplib
from datetime import datetime
from flask import Flask, jsonify, request, send_file
from flask_sqlalchemy import SQLAlchemy
from config import Config
from models import (
    db,
    CompanyProfile, SmtpAccount,
    Client, Product, Invoice, InvoiceItem
)
from invoice_utils import render_invoice_pdf, send_invoice_email

app = Flask(__name__, static_folder='../frontend', static_url_path='/')
app.config['SQLALCHEMY_DATABASE_URI']       = f"sqlite:///{Config.DB_PATH}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()


# ─── COMPANY PROFILES ───────────────────────────────────────────────────────

@app.route('/api/presets', methods=['GET','POST'])
def presets():
    if request.method == 'GET':
        return jsonify([{
            'id': p.id,
            'company_name': p.company_name,
            'company_address': p.company_address,
            'company_email': p.company_email,
            'company_phone': p.company_phone
        } for p in CompanyProfile.query.order_by(CompanyProfile.id)])
    data = request.get_json(force=True)
    p = CompanyProfile(
        company_name    = data['company_name'],
        company_address = data.get('company_address',''),
        company_email   = data.get('company_email',''),
        company_phone   = data.get('company_phone','')
    )
    db.session.add(p)
    db.session.commit()
    return jsonify({'id': p.id}), 201

@app.route('/api/presets/<int:id>', methods=['PUT','DELETE'])
def preset_detail(id):
    p = CompanyProfile.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json(force=True)
        for attr in ('company_name','company_address','company_email','company_phone'):
            if attr in data:
                setattr(p, attr, data[attr])
        db.session.commit()
        return jsonify({'status': 'updated'})
    db.session.delete(p)
    db.session.commit()
    return jsonify({'status': 'deleted'})


# ─── SMTP ACCOUNTS ─────────────────────────────────────────────────────────

@app.route('/api/smtp-configs', methods=['GET','POST'])
def smtp_configs():
    if request.method == 'GET':
        return jsonify([{'id': m.id, 'email': m.email} for m in SmtpAccount.query.order_by(SmtpAccount.id)])
    data = request.get_json(force=True)
    # verify credentials immediately
    try:
        with smtplib.SMTP_SSL(Config.SMTP_SERVER, Config.SMTP_PORT) as smtp:
            smtp.login(data['email'], data['password'])
    except:
        return jsonify({'error': 'verification failed'}), 400

    m = SmtpAccount(email=data['email'], password=data['password'])
    db.session.add(m)
    db.session.commit()
    return jsonify({'id': m.id}), 201

@app.route('/api/smtp-configs/<int:id>', methods=['DELETE'])
def smtp_detail(id):
    m = SmtpAccount.query.get_or_404(id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'status': 'deleted'})

@app.route('/api/verify-smtp', methods=['POST'])
def verify_smtp():
    data = request.get_json(force=True)
    try:
        with smtplib.SMTP_SSL(Config.SMTP_SERVER, Config.SMTP_PORT) as smtp:
            smtp.login(data['email'], data['password'])
        return '', 200
    except:
        return '', 400

@app.route('/api/test-email', methods=['POST'])
def test_email():
    cfg = request.get_json(force=True)
    try:
        # send a quick test message to yourself
        fake_inv = type('X',(object,),{
            'client': type('C',(),{'email': cfg['email']})(),
            'id': 0, 'date': datetime.today().date(),
            'total': 0, 'items': []
        })()
        send_invoice_email(fake_inv, None, smtp_cfg=cfg)
        return '', 200
    except:
        return '', 500


# ─── CLIENTS ────────────────────────────────────────────────────────────────

@app.route('/api/clients', methods=['GET','POST'])
def clients():
    if request.method == 'GET':
        return jsonify([{
            'id': c.id, 'name': c.name, 'email': c.email,
            'address': c.address, 'phone': c.phone
        } for c in Client.query.order_by(Client.id)])
    data = request.get_json(force=True)
    c = Client(
        name    = data['name'],
        email   = data['email'],
        address = data.get('address',''),
        phone   = data.get('phone','')
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({'id': c.id}), 201

@app.route('/api/clients/<int:id>', methods=['PUT','DELETE'])
def client_detail(id):
    c = Client.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json(force=True)
        for attr in ('name','email','address','phone'):
            if attr in data:
                setattr(c, attr, data[attr])
        db.session.commit()
        return jsonify({'status': 'updated'})
    db.session.delete(c)
    db.session.commit()
    return jsonify({'status': 'deleted'})


# ─── PRODUCTS ───────────────────────────────────────────────────────────────

@app.route('/api/products', methods=['GET','POST'])
def products():
    if request.method == 'GET':
        return jsonify([{
            'id': p.id, 'name': p.name,
            'description': p.description, 'price': p.price
        } for p in Product.query.order_by(Product.id)])
    data = request.get_json(force=True)
    p = Product(
        name        = data['name'],
        description = data.get('description',''),
        price       = data['price']
    )
    db.session.add(p)
    db.session.commit()
    return jsonify({'id': p.id}), 201

@app.route('/api/products/<int:id>', methods=['PUT','DELETE'])
def product_detail(id):
    p = Product.query.get_or_404(id)
    if request.method == 'PUT':
        data = request.get_json(force=True)
        for attr in ('name','description','price'):
            if attr in data:
                setattr(p, attr, data[attr])
        db.session.commit()
        return jsonify({'status': 'updated'})
    db.session.delete(p)
    db.session.commit()
    return jsonify({'status': 'deleted'})


# ─── INVOICES ───────────────────────────────────────────────────────────────

@app.route('/api/invoices', methods=['GET','POST'])
def invoices():
    if request.method == 'GET':
        invs = Invoice.query.order_by(Invoice.date.desc())
        return jsonify([{
            'id':    inv.id,
            'client':inv.client.name,
            'date':  str(inv.date),
            'total': inv.total
        } for inv in invs])
    data = request.get_json(force=True)
    inv = Invoice(
        client_id       = data['client_id'],
        date            = datetime.fromisoformat(data['date']).date(),
        company_name    = data.get('company_name',''),
        company_address = data.get('company_address',''),
        company_email   = data.get('company_email',''),
        company_phone   = data.get('company_phone',''),
        total           = 0
    )
    db.session.add(inv)
    db.session.flush()

    total = 0
    for it in data['items']:
        ii = InvoiceItem(
            invoice_id = inv.id,
            product_id = it['product_id'],
            quantity   = it['quantity'],
            unit_price = it['unit_price']
        )
        total += it['quantity'] * it['unit_price']
        db.session.add(ii)

    inv.total = total
    db.session.commit()
    return jsonify({'id': inv.id, 'total': inv.total}), 201

@app.route('/api/invoices/<int:id>', methods=['GET','PUT','DELETE'])
def invoice_detail(id):
    inv = Invoice.query.get_or_404(id)
    if request.method == 'GET':
        return jsonify({
            'id': inv.id,
            'client_id': inv.client_id,
            'date': str(inv.date),
            'company_name': inv.company_name,
            'company_address': inv.company_address,
            'company_email': inv.company_email,
            'company_phone': inv.company_phone,
            'total': inv.total,
            'items': [
                {
                    'product_id': i.product_id,
                    'quantity':   i.quantity,
                    'unit_price': i.unit_price
                }
                for i in inv.items
            ]
        })
    if request.method == 'PUT':
        data = request.get_json(force=True)
        inv.date            = datetime.fromisoformat(data['date']).date()
        inv.company_name    = data.get('company_name', inv.company_name)
        inv.company_address = data.get('company_address', inv.company_address)
        inv.company_email   = data.get('company_email', inv.company_email)
        inv.company_phone   = data.get('company_phone', inv.company_phone)
        inv.items[:] = []  # clear existing
        total = 0
        for it in data['items']:
            ii = InvoiceItem(
                invoice_id = inv.id,
                product_id = it['product_id'],
                quantity   = it['quantity'],
                unit_price = it['unit_price']
            )
            total += ii.quantity * ii.unit_price
            inv.items.append(ii)
        inv.total = total
        db.session.commit()
        return jsonify({'status': 'updated'})
    # DELETE
    db.session.delete(inv)
    db.session.commit()
    return jsonify({'status':'deleted'})


# ─── PDF & EMAIL ───────────────────────────────────────────────────────────

@app.route('/api/invoices/<int:id>/pdf')
def invoice_pdf(id):
    inv  = Invoice.query.get_or_404(id)
    path = render_invoice_pdf(inv)
    return send_file(path, as_attachment=True)

@app.route('/api/invoices/<int:id>/send', methods=['POST'])
def invoice_send(id):
    inv  = Invoice.query.get_or_404(id)
    cfg  = request.get_json(force=True)  # { email, password }
    pdf  = render_invoice_pdf(inv)
    send_invoice_email(inv, pdf, smtp_cfg=cfg)
    return jsonify({'status':'sent'})


# ─── STATIC CATCH-ALL ──────────────────────────────────────────────────────

@app.route('/', defaults={'path':''})
@app.route('/<path:path>')
def serve(path):
    full = os.path.join(app.static_folder, path)
    if path and os.path.exists(full):
        return app.send_static_file(path)
    return app.send_static_file('index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
