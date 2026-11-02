"""Short-lived, server-owned actions. A model argument can never authorize deletion."""
import time

class PendingActions:
    def __init__(self):
        self.actions = {}

    def put(self, key, name, arguments):
        self.actions = {k: v for k, v in self.actions.items() if v[0] > time.monotonic()}
        if len(self.actions) >= 1000:
            self.actions.pop(next(iter(self.actions)))
        self.actions[key] = (time.monotonic() + 600, name, arguments)

    def take(self, key):
        action = self.actions.pop(key, None)
        return action[1:] if action and action[0] > time.monotonic() else None

pending_actions = PendingActions()
