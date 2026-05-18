"""Seed sample transactions and reviews for testing"""
import uuid
from datetime import datetime, timedelta
from database.config import SessionLocal
from database.models import Transaction, Review, User, TransactionType, TransactionStatus
import random

def seed_earnings_and_reviews():
    db = SessionLocal()
    
    try:
        # Get coach and players
        coach = db.query(User).filter(User.email == 'coach@test.com').first()
        if not coach:
            print("Coach not found. Please create coach@test.com first.")
            return
        
        players = db.query(User).filter(User.role == 'PLAYER').limit(5).all()
        if not players:
            print("No players found.")
            return
        
        print(f"Seeding data for coach: {coach.email}")
        
        # Create transactions
        transaction_types = [TransactionType.SESSION, TransactionType.TRAINING_PLAN, TransactionType.CONTENT]
        statuses = [TransactionStatus.PAID, TransactionStatus.PAID, TransactionStatus.PAID, TransactionStatus.PENDING]
        
        for i in range(15):
            player = random.choice(players)
            trans_type = random.choice(transaction_types)
            status = random.choice(statuses)
            
            amount = 80 if trans_type == TransactionType.SESSION else 150
            days_ago = random.randint(1, 60)
            created_date = datetime.utcnow() - timedelta(days=days_ago)
            
            transaction = Transaction(
                id=str(uuid.uuid4()),
                coach_id=coach.id,
                player_id=player.id,
                transaction_type=trans_type,
                amount=amount,
                status=status,
                description=f"{trans_type.value.replace('_', ' ').title()} with {player.name}",
                created_at=created_date,
                paid_at=created_date if status == TransactionStatus.PAID else None
            )
            db.add(transaction)
            print(f"Created transaction: ${amount} - {status.value}")
        
        # Create reviews
        ratings = [5, 5, 5, 4, 4, 3]
        comments = [
            "Excellent coaching! My batting improved significantly.",
            "Very detailed feedback on my bowling action. Highly recommend!",
            "Great drills and patient coaching. Would love more video analysis.",
            "Best cricket coach I have worked with. Very professional.",
            "Good sessions, very structured training plan.",
            "Helpful feedback, saw improvement quickly."
        ]
        
        for i, player in enumerate(players[:6]):
            days_ago = random.randint(5, 45)
            review = Review(
                id=str(uuid.uuid4()),
                coach_id=coach.id,
                player_id=player.id,
                rating=ratings[i] if i < len(ratings) else 4,
                comment=comments[i] if i < len(comments) else "Great coach!",
                created_at=datetime.utcnow() - timedelta(days=days_ago)
            )
            db.add(review)
            print(f"Created review: {ratings[i] if i < len(ratings) else 4} stars from {player.name}")
        
        db.commit()
        print("\n✅ Successfully seeded transactions and reviews!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_earnings_and_reviews()
