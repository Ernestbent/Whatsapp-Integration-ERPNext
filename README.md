# WhatsApp – ERPNext Integration

## Overview
This integration connects WhatsApp Business with ERPNext, enabling automated messaging and real-time communication with customers. The integration works on specific event hooks such as submission of Sales Orders, Delivery Notes, Sales Invoices, and Payment Entries. Additionally, it provides a dedicated GUI page within ERPNext to chat directly with customers.

---

## Features
- Send WhatsApp messages from ERPNext Sales Orders, Invoices, or other documents.
- Receive messages and log them within ERPNext.
- Attach message logs to relevant customers or documents.
- Support for automated alerts for transactions or workflow actions.
- Easy configuration of WhatsApp API credentials.

---

## Prerequisites
- **ERPNext** version: specify your version (e.g., 14.x or 15.x)
- **Frappe** version: specify version
- An Application created on Meta Developers Account with Business Profile and so on.
- Message Templates which can be created in ERPNext under Message Template Document.
- Python 3.10+ (depending on your ERPNext version)
- Node.js if any front-end integration is used (optional)

---

## Installation
**Step 0: Get the App**
```bash
bench get-app https://github.com/Ernestbent/Whatsapp-Integration-ERPNext.git
```

**Step 1: Install app on site**
```bash
bench --site {sitename} install-app whatsapp_integration

```

**Step 2: Run Bench Migrate**
```bash
bench --site {sitename} migrate
```



