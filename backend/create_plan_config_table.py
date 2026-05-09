"""
Create plan_config table and seed with default plans.
"""
from sqlalchemy import text
from database.config import SessionLocal, engine
from database.models.plan_config import PlanConfig

def create_and_seed_plans():
    db = SessionLocal()
    try:
        # Create table
        PlanConfig.__table__.create(engine, checkfirst=True)
        print("[OK] plan_config table created")
        
        # Check if plans already exist
        existing = db.query(PlanConfig).count()
        if existing > 0:
            print(f"[OK] Plans already exist ({existing} plans)")
            return
        
        # Seed default plans
        plans = [
            # Player plans
            PlanConfig(
                plan_key="player_free",
                role="PLAYER",
                display_name="Free",
                price_inr=0,
                duration_days=0,
                max_biomech_per_month=2,
                max_ocr_hours_per_month=0.5,
                max_submissions_per_month=1,
                max_players_in_dashboard=0,
            ),
            PlanConfig(
                plan_key="player_silver",
                role="PLAYER",
                display_name="Silver",
                price_inr=29900,  # ₹299
                duration_days=30,
                max_biomech_per_month=10,
                max_ocr_hours_per_month=5.0,
                max_submissions_per_month=5,
                max_players_in_dashboard=0,
            ),
            PlanConfig(
                plan_key="player_gold",
                role="PLAYER",
                display_name="Gold",
                price_inr=99900,  # ₹999
                duration_days=30,
                max_biomech_per_month=-1,  # unlimited
                max_ocr_hours_per_month=-1.0,
                max_submissions_per_month=-1,
                max_players_in_dashboard=0,
            ),
            # Coach plans
            PlanConfig(
                plan_key="coach_starter",
                role="COACH",
                display_name="Coach Starter",
                price_inr=49900,  # ₹499
                duration_days=30,
                max_biomech_per_month=20,
                max_ocr_hours_per_month=10.0,
                max_submissions_per_month=10,
                max_players_in_dashboard=5,
            ),
            PlanConfig(
                plan_key="coach_pro",
                role="COACH",
                display_name="Coach Pro",
                price_inr=149900,  # ₹1499
                duration_days=30,
                max_biomech_per_month=-1,
                max_ocr_hours_per_month=-1.0,
                max_submissions_per_month=-1,
                max_players_in_dashboard=20,
            ),
            PlanConfig(
                plan_key="academy",
                role="COACH",
                display_name="Academy",
                price_inr=499900,  # ₹4999
                duration_days=30,
                max_biomech_per_month=-1,
                max_ocr_hours_per_month=-1.0,
                max_submissions_per_month=-1,
                max_players_in_dashboard=-1,
            ),
        ]
        
        db.add_all(plans)
        db.commit()
        print(f"[OK] Seeded {len(plans)} default plans")
        
    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_and_seed_plans()
    print("\n[OK] Plan configuration complete")
