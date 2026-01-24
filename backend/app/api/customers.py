from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.customer import Customer
from pydantic import BaseModel, Field  # ✅ Import Field เพิ่ม

router = APIRouter()

# Schema ของ Pydantic
class CustomerSchema(BaseModel):
    id: int
    name: str
    phone: str | None = None
    
    # ✅ FIX: Map ค่าจาก 'channel' (DB) มาใส่ 'contact_channel' (Frontend)
    contact_channel: str | None = Field(default=None, validation_alias="channel")
    
    address: str | None = None

    class Config:
        from_attributes = True

class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    contact_channel: str | None = None
    address: str | None = None

# --- Routes ---

@router.get("/", response_model=List[CustomerSchema])
def read_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Customer).offset(skip).limit(limit).all()

@router.post("/", response_model=CustomerSchema)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_cust = Customer(
        name=customer.name,
        phone=customer.phone,
        channel=customer.contact_channel, # Map contact_channel -> channel (Database field)
        address=customer.address
    )
    db.add(db_cust)
    db.commit()
    db.refresh(db_cust)
    return db_cust

@router.put("/{customer_id}", response_model=CustomerSchema)
def update_customer(customer_id: int, customer: CustomerCreate, db: Session = Depends(get_db)):
    db_cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not db_cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    db_cust.name = customer.name
    db_cust.phone = customer.phone
    db_cust.channel = customer.contact_channel
    db_cust.address = customer.address
    
    db.commit()
    db.refresh(db_cust)
    return db_cust

@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    db_cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not db_cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    db.delete(db_cust)
    db.commit()
    return None