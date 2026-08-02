"""
Import all ORM model modules so that Base.metadata has every table registered
before create_all is called in lifespan.
"""
# Order matters: referenced tables must be imported before referencing ones.
from app.models.auth import (  # noqa: F401
    Organization, User, Role, Permission, RolePermission, UserRole,
    Session, InviteToken, PasswordReset, AuditLog, NotificationPreference,
)
from app.models.topology import (  # noqa: F401
    Warehouse, Zone, Aisle, Rack, Shelf, Bin, Product,
)
from app.models.mission import Robot, Mission, MissionZone  # noqa: F401
from app.models.observation import Observation  # noqa: F401
from app.models.reconciliation import Inventory, ReconciliationResult, Alert  # noqa: F401

__all__ = [
    "Organization", "User", "Role", "Permission", "RolePermission", "UserRole",
    "Session", "InviteToken", "PasswordReset", "AuditLog", "NotificationPreference",
    "Warehouse", "Zone", "Aisle", "Rack", "Shelf", "Bin", "Product",
    "Robot", "Mission", "MissionZone",
    "Observation",
    "Inventory", "ReconciliationResult", "Alert",
]
