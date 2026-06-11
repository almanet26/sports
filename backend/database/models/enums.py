"""Shared enum values for subscription tier roles and platform identity roles."""

# Account type — stored in users.role.  Permanent.  Set at registration.
# These are the only three valid values for the users.role column.
USER_ROLE_VALUES = ("PLAYER", "COACH", "ADMIN")

# Subscription tier — stored in subscriptions.role and plan_config.role.
# users.role never holds one of these values.
ROLE_VALUES = (
    "bronze",
    "coach_basic",
    "silver",
    "gold",
    "coach_platinum",
)

SUBSCRIPTION_STATUS_VALUES = (
    "active",
    "inactive",
    "past_due",
    "expired",
)

# Keep legacy alias so any existing import of PLATFORM_ROLE_VALUES still works.
PLATFORM_ROLE_VALUES = USER_ROLE_VALUES
