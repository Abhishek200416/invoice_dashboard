from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class CompanyProfile(db.Model):
    __tablename__ = 'company_profiles'
    id               = db.Column(db.Integer, primary_key=True)
    company_name     = db.Column(db.String(128), nullable=False)
    company_address  = db.Column(db.String(256))
    company_email    = db.Column(db.String(128))
    company_phone    = db.Column(db.String(32))

class SmtpAccount(db.Model):
    __tablename__ = 'smtp_accounts'
    id       = db.Column(db.Integer, primary_key=True)
    email    = db.Column(db.String(128), nullable=False)
    password = db.Column(db.String(128), nullable=False)

class Client(db.Model):
    __tablename__ = 'clients'
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(128), nullable=False)
    email    = db.Column(db.String(128), nullable=False)
    address  = db.Column(db.String(256))
    phone    = db.Column(db.String(32))
    invoices = db.relationship('Invoice', backref='client', cascade="all, delete-orphan", lazy=True)

class Product(db.Model):
    __tablename__ = 'products'
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(128), nullable=False)
    description = db.Column(db.String(256))
    price       = db.Column(db.Float, nullable=False)
    items       = db.relationship('InvoiceItem', backref='product', cascade="all, delete-orphan", lazy=True)

class Invoice(db.Model):
    __tablename__ = 'invoices'
    id               = db.Column(db.Integer, primary_key=True)
    client_id        = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    date             = db.Column(db.Date, nullable=False)
    company_name     = db.Column(db.String(128))
    company_address  = db.Column(db.String(256))
    company_email    = db.Column(db.String(128))
    company_phone    = db.Column(db.String(32))
    total            = db.Column(db.Float, nullable=False)
    items            = db.relationship('InvoiceItem', backref='invoice', cascade="all, delete-orphan", lazy=True)

class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'
    id         = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity   = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float,   nullable=False)
