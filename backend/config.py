import os

class Config:
    BASE_DIR = os.path.dirname(__file__)
    DB_PATH  = os.path.join(BASE_DIR, 'database.db')

    # default SMTP host/port for verify/test/send
    SMTP_SERVER = 'smtp.gmail.com'
    SMTP_PORT   = 465
