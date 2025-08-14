import os
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from email.message import EmailMessage
import smtplib
from config import Config

def render_invoice_pdf(invoice):
    out_folder = Config.PDF_FOLDER
    os.makedirs(out_folder, exist_ok=True)
    path = os.path.join(out_folder, f"invoice_{invoice.id}.pdf")
    c = canvas.Canvas(path, pagesize=LETTER)
    width, height = LETTER

    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, height - 50, invoice.company_name or Config.COMPANY_NAME)
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 80, f"Invoice #{invoice.id}    Date: {invoice.date}")

    # Company info (optional)
    y = height - 110
    if invoice.company_address:
        c.drawString(50, y, invoice.company_address); y -= 15
    if invoice.company_email:
        c.drawString(50, y, invoice.company_email); y -= 15
    if invoice.company_phone:
        c.drawString(50, y, invoice.company_phone); y -= 15

    # Client info
    c.drawString(50, y - 10, "Billed To:")
    y -= 30
    c.drawString(70, y, invoice.client.name)
    if invoice.client.address:
        c.drawString(70, y - 15, invoice.client.address)
        y -= 15
    c.drawString(70, y - 30, invoice.client.email)
    y -= 50

    # Table header
    c.setFont("Helvetica-Bold", 10)
    for text, x in [("Description", 50), ("Qty", 300), ("Unit Price", 350), ("Line Total", 450)]:
        c.drawString(x, y, text)
    c.line(50, y - 2, 550, y - 2)

    # Table rows
    c.setFont("Helvetica", 10)
    y -= 20
    for item in invoice.items:
        total = item.quantity * item.unit_price
        c.drawString(50, y, item.product.name)
        c.drawRightString(330, y, str(item.quantity))
        c.drawRightString(410, y, f"₹{item.unit_price:.2f}")
        c.drawRightString(520, y, f"₹{total:.2f}")
        y -= 15
        if y < 100:
            c.showPage()
            y = height - 50

    # Grand total
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(520, y - 10, f"Grand Total: ₹{invoice.total:.2f}")

    c.save()
    return path


def send_invoice_email(invoice, pdf_path, smtp_cfg):
    """
    smtp_cfg: dict with keys 'email' and 'password'
    """
    msg = EmailMessage()
    msg['Subject'] = f"Invoice #{invoice.id} from {invoice.company_name}"
    msg['From']    = smtp_cfg['email']
    msg['To']      = invoice.client.email
    msg.set_content(
        f"Hello {invoice.client.name},\n\n"
        f"Please find attached Invoice #{invoice.id} dated {invoice.date}.\n"
        f"Total Due: ₹{invoice.total:.2f}\n\n"
        "Thank you for your business!\n"
        f"{invoice.company_name}"
    )

    if pdf_path:
        with open(pdf_path, 'rb') as f:
            msg.add_attachment(
                f.read(),
                maintype='application',
                subtype='pdf',
                filename=os.path.basename(pdf_path)
            )

    with smtplib.SMTP_SSL(Config.SMTP_SERVER, Config.SMTP_PORT) as smtp:
        smtp.login(smtp_cfg['email'], smtp_cfg['password'])
        smtp.send_message(msg)
