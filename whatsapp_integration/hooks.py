app_name = "whatsapp_integration"
app_title = "ERPNext Whatsapp"
app_publisher = "Autozone Professional Limited"
app_description = "This App integrates with Whatsapp "
app_email = "ernestben69@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "whatsapp_integration",
# 		"logo": "/assets/whatsapp_integration/logo.png",
# 		"title": "ERPNext Whatsapp",
# 		"route": "/whatsapp_integration",
# 		"has_permission": "whatsapp_integration.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/whatsapp_integration/css/whatsapp_integration.css"
app_include_js = [
    "/assets/whatsapp_integration/js/whatsapp_notification.js"
]


# include js, css files in header of web template
# web_include_css = "/assets/whatsapp_integration/css/whatsapp_integration.css"
# web_include_js = "/assets/whatsapp_integration/js/whatsapp_integration.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "whatsapp_integration/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Whatsapp Message": "public/js/send_reply.js",
    "Sales Order": [
        "public/js/send_template_sales_order.js"
    ],
    "Sales Invoice":[
        "public/js/send_template_sales_invoice.js"
    ],
    "Delivery Note": [
        "public/js/send_template_delivery_note.js"
    ],
    "Payment Entry": [
        "public/js/send_payment_confrimation_template.js"
    ],
    # "Whatsapp Live Chat": "public/js/whatsapp_live_chat.js",  
    # "Whatsapp Setting" : "public/js/create_chats_customers.js",
    "Whatsapp Message Template": "public/js/message_template_button.js",   
}

# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "whatsapp_integration/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "whatsapp_integration.utils.jinja_methods",
# 	"filters": "whatsapp_integration.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "whatsapp_integration.install.before_install"
# after_install = "whatsapp_integration.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "whatsapp_integration.uninstall.before_uninstall"
# after_uninstall = "whatsapp_integration.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "whatsapp_integration.utils.before_app_install"
# after_app_install = "whatsapp_integration.utils.after_app_install"

# Integration Cleanupsend_whatsapp_document
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "whatsapp_integration.utils.before_app_uninstall"
# after_app_uninstall = "whatsapp_integration.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "whatsapp_integration.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events
doc_events = {
    "Sales Order": {
        "on_submit": [
            "whatsapp_integration.erpnext_whatsapp.custom_scripts.whatsapp_api.send_order_confirmation",
            "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_sales_order.send_sales_order_background",
           
            ],
        "Sales Order": {
            "on_update_after_submit": "whatsapp_integration.erpnext_whatsapp.custom_scripts.notifications_on_dispacth.send_dispatch_notification",
    }
    },
    "Sales Invoice": {
        "on_submit": [
            "whatsapp_integration.erpnext_whatsapp.custom_scripts.whatsapp_api.send_invoice_notification",
            "whatsapp_integration.erpnext_whatsapp.custom_scripts.upload_media_whatsapp_cloud.send_proforma_background",
            
        ]
    },
    "Delivery Note":{
        "on_submit": [
            "whatsapp_integration.erpnext_whatsapp.custom_scripts.whatsapp_api.send_delivery_notification",
            "whatsapp_integration.erpnext_whatsapp.custom_scripts.upload_delivery_note_document.send_delivery_note_background",
        ]
    },
    "Customer":{
        "after_insert": [
            "whatsapp_integration.whatsapp_webhook.webhook.link_whatsapp_messages_to_customer",
        ],
        "on_update": [
            "whatsapp_integration.whatsapp_webhook.webhook.link_whatsapp_messages_to_customer",
        ]
    },
    "Payment Entry":{
        "on_submit": "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_templates.on_payment_entry_submit"
    },
    # "Purchase Order":{
    #     "on_submit": "whatsapp_integration.erpnext_whatsapp.custom_scripts.send_message_templates.on_purchase_order_submit"
    # }
   
}

# Scheduled Tasks
# ---------------
# scheduler_events = {
# 	"daily": [
# 		"whatsapp_integration.erpnext_whatsapp.background_jobs.send_report_daily.send_general_ledger_email"
# 	],
	
# }

# Testing
# -------

# before_tests = "whatsapp_integration.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "whatsapp_integration.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "whatsapp_integration.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["whatsapp_integration.utils.before_request"]
# after_request = ["whatsapp_integration.utils.after_request"]

# Job Events
# ----------
# before_job = ["whatsapp_integration.utils.before_job"]
# after_job = ["whatsapp_integration.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"whatsapp_integration.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

csrf_exempt = ["/api/method/whatsapp_integration.whatsapp_webhook.receive_whatsapp"]


