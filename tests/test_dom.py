"""
DOM field schema and representation tests.
"""

from backend.api.schemas import PageField, PageMetadata

def test_page_field_sanitized_representation():
    field = PageField(
        id="email_input",
        name="email",
        type="email",
        label="Email Address",
        placeholder="name@domain.com",
        value="[REDACTED_EMAIL]",
        visible=True,
        redacted=True
    )
    assert field.id == "email_input"
    assert field.redacted is True
    assert field.value == "[REDACTED_EMAIL]"

def test_page_metadata_sanitized():
    meta = PageMetadata(
        url="/scholarship.html",
        title="Scholarship Portal",
        domain="scholarships.gov.in"
    )
    assert meta.domain == "scholarships.gov.in"
