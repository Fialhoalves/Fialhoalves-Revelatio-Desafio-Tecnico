import math
import time
from collections import defaultdict, deque
from collections.abc import Callable

from app.core.config import get_settings
from app.core.errors import TooManyAttempts

_MAX_TRACKED_KEYS = 10_000


class LoginRateLimiter:
    """Limita tentativas de login malsucedidas por chave (IP + e-mail) em uma janela de tempo.

    O estado fica na memória do processo: com mais de uma instância da API cada
    uma conta separadamente. Para escalar, trocar por um armazenamento
    compartilhado (por exemplo Redis) mantendo esta interface.
    """

    def __init__(self, max_attempts: int, window_seconds: int, clock: Callable[[], float] = time.monotonic):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        failures = self._failures[key]
        limit = self._clock() - self.window_seconds
        while failures and failures[0] <= limit:
            failures.popleft()
        return failures

    def check(self, key: str) -> None:
        """Levanta TooManyAttempts se a chave atingiu o limite de falhas."""
        failures = self._recent(key)
        if len(failures) >= self.max_attempts:
            retry_after = math.ceil(failures[0] + self.window_seconds - self._clock())
            raise TooManyAttempts(retry_after=max(retry_after, 1))
        if not failures:
            del self._failures[key]

    def register_failure(self, key: str) -> None:
        if len(self._failures) >= _MAX_TRACKED_KEYS:
            self._prune()
        self._failures[key].append(self._clock())

    def reset(self, key: str | None = None) -> None:
        if key is None:
            self._failures.clear()
        else:
            self._failures.pop(key, None)

    def _prune(self) -> None:
        for key in list(self._failures):
            if not self._recent(key):
                del self._failures[key]


_settings = get_settings()
login_limiter = LoginRateLimiter(_settings.login_max_attempts, _settings.login_window_seconds)
