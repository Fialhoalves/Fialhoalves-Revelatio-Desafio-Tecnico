import pytest

from app.core.errors import TooManyAttempts
from app.core.rate_limit import LoginRateLimiter


def _login(client, email, password):
    return client.post("/auth/login", data={"username": email, "password": password})


def test_blocks_after_repeated_failures_even_with_correct_password(client, alice):
    for _ in range(5):
        assert _login(client, "alice@example.com", "errada12345").status_code == 401
    resp = _login(client, "alice@example.com", "senha12345")
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMITED"
    assert int(resp.headers["retry-after"]) > 0


def test_success_resets_the_counter(client, alice):
    for _ in range(4):
        _login(client, "alice@example.com", "errada12345")
    assert _login(client, "alice@example.com", "senha12345").status_code == 200
    for _ in range(4):
        assert _login(client, "alice@example.com", "errada12345").status_code == 401


def test_other_accounts_are_not_affected(client, alice, bob):
    for _ in range(5):
        _login(client, "alice@example.com", "errada12345")
    assert _login(client, "bob@example.com", "senha12345").status_code == 200


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_window_expires():
    clock = FakeClock()
    limiter = LoginRateLimiter(max_attempts=2, window_seconds=60, clock=clock)
    limiter.register_failure("k")
    limiter.register_failure("k")
    with pytest.raises(TooManyAttempts) as exc:
        limiter.check("k")
    assert exc.value.retry_after == 60

    clock.now += 61
    limiter.check("k")  # janela expirou, volta a permitir
