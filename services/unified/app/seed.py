"""
app/seed.py — Automatic database seeder for auth-service demo accounts, roles, and permissions.
"""
import uuid
import structlog
from sqlalchemy.future import select

from app.database import AsyncSessionLocal
from app.models.auth import Organization, User, UserRole
from app.repositories.auth_repo import AuthRepository
from app.core.security import hash_password

log = structlog.get_logger(__name__)

DEFAULT_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEFAULT_WAREHOUSE_ID = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

DEMO_USERS = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000010"),
        "email": "admin@wareops.dev",
        "display_name": "Admin User",
        "role_name": "ENTERPRISE_ADMIN",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000011"),
        "email": "manager@wareops.dev",
        "display_name": "Manager User",
        "role_name": "WAREHOUSE_MANAGER",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000012"),
        "email": "supervisor@wareops.dev",
        "display_name": "Supervisor User",
        "role_name": "WAREHOUSE_SUPERVISOR",
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000013"),
        "email": "operator@wareops.dev",
        "display_name": "Operator User",
        "role_name": "WAREHOUSE_OPERATOR",
    },
]

async def seed_initial_data() -> None:
    """Ensure initial organization, system roles, base permissions, and demo user accounts exist."""
    async with AsyncSessionLocal() as session:
        try:
            repo = AuthRepository(session)

            # 1. Check default Organization
            result = await session.execute(
                select(Organization).where(Organization.id == DEFAULT_ORG_ID)
            )
            org = result.scalars().first()

            if not org:
                log.info("Seeding default organization...", org_id=str(DEFAULT_ORG_ID))
                org = Organization(
                    id=DEFAULT_ORG_ID,
                    name="WAREOps Enterprise",
                    slug="wareops-enterprise",
                    is_active=True,
                )
                session.add(org)
                await session.flush()

            # 2. Seed System Roles & Base Permissions
            log.info("Seeding default system roles and permissions...")
            seeded_roles = await repo.seed_default_roles(DEFAULT_ORG_ID)
            role_map = {r.name: r for r in seeded_roles}

            # 3. Seed Demo Users and Assign Roles
            default_password_hash = hash_password("Password123!")

            for u_data in DEMO_USERS:
                res = await session.execute(
                    select(User).where(User.email == u_data["email"])
                )
                user = res.scalars().first()
                if not user:
                    log.info("Seeding demo user...", email=u_data["email"])
                    user = User(
                        id=u_data["id"],
                        org_id=DEFAULT_ORG_ID,
                        email=u_data["email"],
                        display_name=u_data["display_name"],
                        password_hash=default_password_hash,
                        status="ACTIVE",
                        mfa_enabled=False,
                    )
                    session.add(user)
                    await session.flush()

                # Ensure UserRole link exists
                ur_res = await session.execute(
                    select(UserRole).where(UserRole.user_id == user.id)
                )
                existing_ur = ur_res.scalars().first()
                if not existing_ur:
                    role_obj = role_map.get(u_data["role_name"])
                    if role_obj:
                        log.info("Assigning role to demo user...", email=user.email, role=role_obj.name)
                        ur = UserRole(
                            user_id=user.id,
                            role_id=role_obj.id,
                            warehouse_id=DEFAULT_WAREHOUSE_ID,
                        )
                        session.add(ur)

            await session.commit()
            log.info("Database seeding completed successfully.")
        except Exception as exc:
            await session.rollback()
            log.error("Failed to seed initial auth data", error=str(exc))
