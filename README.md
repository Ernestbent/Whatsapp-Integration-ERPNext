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
---
Before installing the integration on your ERPNext site, you first need to download the WhatsApp integration app into your bench environment. This step ensures that the app’s code is available locally and can be installed on one or more sites managed by your bench. Without this step, ERPNext would not recognize the integration as an installable app.
```bash
bench get-app https://github.com/Ernestbent/Whatsapp-Integration-ERPNext.git
```
---
**Step 1: Install App on Your Site**

After fetching the app, you need to install it on a specific ERPNext site. This step registers the WhatsApp integration with the site, creates necessary DocTypes, fields, and backend logic, and makes the features available within the ERPNext interface. Without installing the app on the site, the integration cannot function or appear in the ERPNext UI.

```bash
bench --site {sitename} install-app whatsapp_integration

```

**Step 2: Run Bench Migrate**

After installing the app, running `bench migrate` ensures that all database schema changes introduced by the WhatsApp integration are applied to your ERPNext site. This step creates or updates the necessary tables, fields, and permissions required for the integration to function properly. Skipping this step may cause errors or missing functionality when using the app.

```bash
bench --site {sitename} migrate
```
---

## WhatsApp Settings

The **WhatsApp Settings** Doctype is where you configure your WhatsApp Business integration for ERPNext. This is a central configuration point that stores all necessary credentials and connection details required to send and receive messages.  

### Key Fields

| Field | Description |
|-------|-------------|
| **Access Token** | The authentication token provided by the WhatsApp Business API or Meta Developers account. Required for API calls. |
| **Phone Number ID** | The ID of the WhatsApp Business phone number used to send messages. |
| **Business Account ID** | The Meta/WhatsApp Business account ID associated with your number. |
| **Webhook Verify Token** | A token used to verify the webhook endpoint for incoming messages. |
| **Last Sync On** | Timestamp of the last successful sync with WhatsApp API. |

### Purpose

- Authenticate ERPNext to communicate with WhatsApp Business API.
- Store business account and phone number details centrally.
- Manage webhook verification for incoming messages.
- Enable sending and receiving WhatsApp messages from ERPNext documents like Sales Orders, Invoices, Delivery Notes, and Payment Entries.

---

### Screenshot Example

![WhatsApp Settings Screenshot](Whatsapp Settings(1).png)

> The screenshot shows filled fields such as Access Token, Phone Number ID, Business Account ID, and Webhook Verify Token, giving users a clear idea of how to set up their own configuration.




