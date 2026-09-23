import re


DEFAULT_COUNTRY_CODE = "256"
SUPPORTED_COUNTRY_LENGTHS = {
	"256": 9,  # Uganda
	"91": 10,  # India
}


def normalize_whatsapp_number(value, default_country_code=DEFAULT_COUNTRY_CODE):
	"""Return digits-only E.164 form for supported countries.

	Ugandan local numbers may be entered with or without their leading zero.
	Indian numbers must include 91 (or +91) so a ten-digit number is not guessed
	and accidentally routed to the wrong country.
	"""
	raw_value = str(value or "").strip()
	digits = re.sub(r"\D", "", raw_value)
	if digits.startswith("00"):
		digits = digits[2:]

	for country_code, national_length in SUPPORTED_COUNTRY_LENGTHS.items():
		if digits.startswith(country_code) and len(digits) == len(country_code) + national_length:
			return digits

	if default_country_code == "256":
		if digits.startswith("0") and len(digits) == 10:
			return f"256{digits[1:]}"
		if len(digits) == 9:
			return f"256{digits}"

	return digits


def is_supported_whatsapp_number(value):
	digits = re.sub(r"\D", "", str(value or ""))
	return any(
		digits.startswith(country_code)
		and len(digits) == len(country_code) + national_length
		for country_code, national_length in SUPPORTED_COUNTRY_LENGTHS.items()
	)
