"""
Unit tests for browser action schemas and execution safety rules.
"""

# pyrefly: ignore [missing-import]
import pytest
# pyrefly: ignore [missing-import]
from pydantic import ValidationError
from backend.api.schemas import BrowserAction, ActionType, ScrollDirection, AnalyzeRequest, PageField, CommandRequest
from backend.agent.llm_client import MockLLMProvider

def test_valid_click_action():
    action = BrowserAction(action=ActionType.CLICK, target="submit_button", reasoning="Click submit button")
    assert action.action == ActionType.CLICK
    assert action.target == "submit_button"
    assert action.confidence == 1.0

def test_valid_fill_action():
    action = BrowserAction(
        action=ActionType.FILL,
        target="full_name",
        value="Rahul Sharma",
        reasoning="Fill name field"
    )
    assert action.action == ActionType.FILL
    assert action.target == "full_name"
    assert action.value == "Rahul Sharma"

def test_valid_scroll_action():
    action = BrowserAction(
        action=ActionType.SCROLL,
        direction=ScrollDirection.DOWN,
        reasoning="Scroll to view more fields"
    )
    assert action.action == ActionType.SCROLL
    assert action.direction == ScrollDirection.DOWN

def test_dangerous_javascript_injection_blocked():
    dangerous_inputs = [
        "eval('alert(1)')",
        "Function('return process')()",
        "javascript:alert(document.cookie)",
        "<script>window.location='http://attacker.com'</script>",
        "document.cookie",
        "subprocess.Popen(['rm', '-rf', '/'])",
        "os.system('whoami')"
    ]
    for bad_code in dangerous_inputs:
        with pytest.raises(ValidationError):
            BrowserAction(
                action=ActionType.FILL,
                target="search",
                value=bad_code
            )

@pytest.mark.asyncio
async def test_mock_llm_analyze_page_generates_actions():
    provider = MockLLMProvider()
    request = AnalyzeRequest(
        fields=[
            PageField(id="email", name="email", type="email", label="Email", value=None, redacted=False),
            PageField(id="phone", name="phone", type="tel", label="Phone", value=None, redacted=False),
            PageField(id="password", name="password", type="password", label="Password", value="[REDACTED_PASSWORD]", redacted=True)
        ],
        buttons=[
            PageField(id="submitBtn", text="Submit Application")
        ]
    )
    actions = await provider.analyze_page(request)
    assert len(actions) >= 1
    # Check that fill action is suggested for unredacted empty field
    action_types = [a.action for a in actions]
    assert ActionType.FILL in action_types or ActionType.CLICK in action_types

@pytest.mark.asyncio
async def test_mock_llm_process_command_click():
    provider = MockLLMProvider()
    request = CommandRequest(
        command="click on the submit button",
        buttons=[PageField(id="submit", text="Submit")]
    )
    actions = await provider.process_command(request)
    assert len(actions) == 1
    assert actions[0].action == ActionType.CLICK

@pytest.mark.asyncio
async def test_mock_llm_process_command_scroll():
    provider = MockLLMProvider()
    request = CommandRequest(command="scroll down to read terms")
    actions = await provider.process_command(request)
    assert len(actions) == 1
    assert actions[0].action == ActionType.SCROLL
    assert actions[0].direction == ScrollDirection.DOWN
