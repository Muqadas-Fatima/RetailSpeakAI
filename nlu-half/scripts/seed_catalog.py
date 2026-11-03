"""
Comprehensive Seed Script for RetailSpeak AI.
Populates:
1. Default Kiryana Store
2. 35+ Authentic Pakistani Grocery Products (Atta, Rice, Pulses, Dairy, Spices, Beverages)
3. Pakistani Customers with Khata limits and addresses
4. Active Delivery Riders
5. Computes vector embeddings for every product using BAAI/bge-small-en-v1.5

Usage:
    python -m scripts.seed_catalog
"""
import asyncio
import uuid
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.rag_service import embed_text

DEFAULT_STORE_ID = "11111111-1111-1111-1111-111111111111"

SAMPLE_PRODUCTS = [
    # Flour & Grains
    {"name_en": "Chakki Atta 1kg", "name_ur": "چکی آٹا", "name_roman_ur": "ata, atta", "aliases": "flour, gehu ka atta, gandum atta, chakki fresh", "category": "Flour & Grains", "unit": "kg", "price": 140.0, "stock": 250},
    {"name_en": "Chakki Atta 10kg Bag", "name_ur": "چکی آٹا 10 کلو تھیلا", "name_roman_ur": "ata 10 kilo bori", "aliases": "flour bag, 10kg atta, bori", "category": "Flour & Grains", "unit": "bag", "price": 1380.0, "stock": 50},
    {"name_en": "Super Basmati Rice 1kg", "name_ur": "سپر باسمتی چاول", "name_roman_ur": "basmati chawal", "aliases": "rice, chawal, sela chawal, biryani rice", "category": "Flour & Grains", "unit": "kg", "price": 320.0, "stock": 180},
    {"name_en": "Super Basmati Rice 5kg Bag", "name_ur": "سپر باسمتی چاول 5 کلو", "name_roman_ur": "basmati chawal 5kg", "aliases": "rice bag, 5kg chawal, family pack rice", "category": "Flour & Grains", "unit": "bag", "price": 1550.0, "stock": 40},
    {"name_en": "Fine Maida 1kg", "name_ur": "میدہ", "name_roman_ur": "maida", "aliases": "all purpose flour, white flour, samosa maida", "category": "Flour & Grains", "unit": "kg", "price": 160.0, "stock": 90},
    {"name_en": "Sooji 500g", "name_ur": "سوجی", "name_roman_ur": "sooji, suji", "aliases": "semolina, halwa sooji", "category": "Flour & Grains", "unit": "packet", "price": 95.0, "stock": 70},

    # Pulses & Lentils (Daal)
    {"name_en": "Daal Chana 1kg", "name_ur": "دال چنا", "name_roman_ur": "daal chana, dal chana", "aliases": "gram pulse, chana dal, split chickpea", "category": "Pulses", "unit": "kg", "price": 280.0, "stock": 100},
    {"name_en": "Daal Moong Washed 1kg", "name_ur": "دال مونگ دھلی", "name_roman_ur": "daal moong, dal mung", "aliases": "yellow pulse, moong dal", "category": "Pulses", "unit": "kg", "price": 310.0, "stock": 80},
    {"name_en": "Daal Masoor 1kg", "name_ur": "دال مسور", "name_roman_ur": "daal masoor, dal masur", "aliases": "red lentil, masoor dal", "category": "Pulses", "unit": "kg", "price": 290.0, "stock": 90},
    {"name_en": "Safaid Chana 1kg", "name_ur": "سفید چنے", "name_roman_ur": "safaid chana, kabuli chana", "aliases": "white chickpeas, cholay, chholay", "category": "Pulses", "unit": "kg", "price": 360.0, "stock": 85},

    # Dairy & Breakfast
    {"name_en": "Olper's Milk 1L", "name_ur": "اولپرز دودھ", "name_roman_ur": "olper milk, olpers", "aliases": "olpher milk, olper doodh, uht milk, dabba milk", "category": "Dairy", "unit": "litre", "price": 290.0, "stock": 120},
    {"name_en": "MilkPak 1L", "name_ur": "ملک پیک", "name_roman_ur": "milkpak, nestle milk pak", "aliases": "milk pack, nestle doodh, tetra pack milk", "category": "Dairy", "unit": "litre", "price": 295.0, "stock": 110},
    {"name_en": "Farm Fresh Eggs (Dozen)", "name_ur": "فارم انڈے درجن", "name_roman_ur": "anday, anda dozen", "aliases": "eggs, 12 eggs, egg tray, andey", "category": "Dairy", "unit": "dozen", "price": 360.0, "stock": 90},
    {"name_en": "Nurpur Salted Butter 200g", "name_ur": "نورپور مکھن", "name_roman_ur": "nurpur makhan", "aliases": "butter, makhan, salted butter", "category": "Dairy", "unit": "packet", "price": 340.0, "stock": 45},

    # Cooking Oil & Ghee
    {"name_en": "Dalda Banaspati Ghee 1kg Pouch", "name_ur": "ڈالڈا گھی 1 کلو", "name_roman_ur": "dalda ghee, banaspati", "aliases": "ghee, cooking ghee, dalda packet", "category": "Oil & Ghee", "unit": "packet", "price": 540.0, "stock": 90},
    {"name_en": "Dalda Banaspati Ghee 5kg Tin", "name_ur": "ڈالڈا گھی 5 کلو ٹن", "name_roman_ur": "dalda ghee 5kg tin", "aliases": "ghee tin, 5kg ghee dabba", "category": "Oil & Ghee", "unit": "tin", "price": 2650.0, "stock": 30},
    {"name_en": "Habib Cooking Oil 1L Pouch", "name_ur": "حبیب کوکنگ آئل", "name_roman_ur": "habib oil", "aliases": "cooking oil, habib pouch, tail", "category": "Oil & Ghee", "unit": "packet", "price": 520.0, "stock": 85},

    # Spices & Seasoning
    {"name_en": "Shan Special Bombay Biryani Masala", "name_ur": "شان بمبئی بریانی مصالحہ", "name_roman_ur": "shan biryani masala", "aliases": "biryani packet, bombay biryani mix, shan masala", "category": "Spices", "unit": "packet", "price": 130.0, "stock": 150},
    {"name_en": "Shan Korma Masala", "name_ur": "شان قورمہ مصالحہ", "name_roman_ur": "shan qorma masala", "aliases": "korma packet, qorma mix", "category": "Spices", "unit": "packet", "price": 130.0, "stock": 100},
    {"name_en": "National Iodized Pink Himalayan Salt 800g", "name_ur": "نیشنل گلابی نمک", "name_roman_ur": "national namak", "aliases": "salt, namak, pink salt, iodized salt", "category": "Spices", "unit": "packet", "price": 60.0, "stock": 140},
    {"name_en": "National Lal Mirch Powder 200g", "name_ur": "نیشنل لال مرچ پاؤڈر", "name_roman_ur": "lal mirch, surkh mirch", "aliases": "red chilli powder, mirch powder", "category": "Spices", "unit": "packet", "price": 220.0, "stock": 90},
    {"name_en": "National Haldi Powder 100g", "name_ur": "نیشنل ہلدی پاؤڈر", "name_roman_ur": "haldi, haldee", "aliases": "turmeric powder, yellow turmeric", "category": "Spices", "unit": "packet", "price": 110.0, "stock": 95},

    # Tea & Beverages
    {"name_en": "Tapal Danedar Tea 450g", "name_ur": "ٹپال دانے دار چائے", "name_roman_ur": "tapal danedar chai", "aliases": "chai, patti, tea, danedar 450g", "category": "Beverages", "unit": "packet", "price": 640.0, "stock": 75},
    {"name_en": "Lipton Yellow Label Tea 400g", "name_ur": "لپٹن یلو لیبل چائے", "name_roman_ur": "lipton chai", "aliases": "lipton tea, yellow label", "category": "Beverages", "unit": "packet", "price": 660.0, "stock": 60},
    {"name_en": "Rooh Afza 800ml", "name_ur": "روح افزا", "name_roman_ur": "rooh afza, jam-e-shirin", "aliases": "red syrup, sharbat, roohafza bottle", "category": "Beverages", "unit": "bottle", "price": 420.0, "stock": 65},
    {"name_en": "Sprite 1L", "name_ur": "سپرائٹ 1 لٹر", "name_roman_ur": "sprite", "aliases": "sprite bottle, cold drink, soda, 1 litre sprite", "category": "Beverages", "unit": "bottle", "price": 120.0, "stock": 80},
    {"name_en": "Sprite 1.5L", "name_ur": "سپرائٹ 1.5 لٹر", "name_roman_ur": "sprite jumbo", "aliases": "sprite 1.5 litre, big sprite, family sprite", "category": "Beverages", "unit": "bottle", "price": 180.0, "stock": 60},
    {"name_en": "7UP 500ml", "name_ur": "سیون اپ 500 ملی", "name_roman_ur": "7up, seven up", "aliases": "7 up, soda, regular 7up", "category": "Beverages", "unit": "bottle", "price": 80.0, "stock": 100},
    {"name_en": "Coca Cola 1.5L", "name_ur": "کوکاکولا 1.5 لٹر", "name_roman_ur": "coke, coca cola", "aliases": "coca cola bottle, coke jumbo, black drink", "category": "Beverages", "unit": "bottle", "price": 190.0, "stock": 80},
    {"name_en": "Pakola Ice Cream Soda 250ml Can", "name_ur": "پاکولا کین", "name_roman_ur": "pakola can", "aliases": "green soda, pakola ice cream soda", "category": "Beverages", "unit": "can", "price": 90.0, "stock": 120},

    # Snacks & Biscuits
    {"name_en": "LU Prince Chocolate Biscuits Box", "name_ur": "پرنس بسکٹ ڈبہ", "name_roman_ur": "prince biscuits, prince dabba", "aliases": "chocolate biscuits, prince box, lu prince", "category": "Snacks", "unit": "box", "price": 360.0, "stock": 50},
    {"name_en": "Peek Freans Sooper Biscuits Half Roll", "name_ur": "سوپر بسکٹ ہاف رول", "name_roman_ur": "sooper biscuit, super", "aliases": "sooper egg and milk, sooper pack", "category": "Snacks", "unit": "packet", "price": 60.0, "stock": 140},
    {"name_en": "Super Crisp Potato Chips Salty", "name_ur": "سپر کرسپ چپس", "name_roman_ur": "super crisp, chips", "aliases": "crisps, lays, potato chips", "category": "Snacks", "unit": "packet", "price": 50.0, "stock": 90},

    # Soap & Cleaning
    {"name_en": "Sunlight Laundry Soap 500g", "name_ur": "سن لائٹ صابن", "name_roman_ur": "sunlight sabun", "aliases": "washing soap, laundry bar, kapray dhonay ka sabun", "category": "Household", "unit": "pcs", "price": 145.0, "stock": 160},
    {"name_en": "Surf Excel Quick Wash 1kg", "name_ur": "سرف ایکسل 1 کلو", "name_roman_ur": "surf excel, surf", "aliases": "washing powder, surf packet, detergent", "category": "Household", "unit": "packet", "price": 590.0, "stock": 70},
    {"name_en": "Dettol Original Anti-Bacterial Soap 135g", "name_ur": "ڈیٹول صابن", "name_roman_ur": "dettol sabun", "aliases": "bath soap, antibacterial soap, dettol bar", "category": "Personal Care", "unit": "pcs", "price": 160.0, "stock": 110}
]

SAMPLE_CUSTOMERS = [
    {
        "customer_id": "c1111111-1111-1111-1111-111111111111",
        "phone_number": "+923001234567",
        "name": "Muhammad Tariq",
        "preferred_language": "ur",
        "khata_enabled": True,
        "khata_credit_limit": 15000.0,
        "current_balance": 2350.0,
        "address": "House 14-B, Street 3, Main Market Gulberg II, Lahore"
    },
    {
        "customer_id": "c2222222-2222-2222-2222-222222222222",
        "phone_number": "+923219876543",
        "name": "Fatima Bibi",
        "preferred_language": "ur",
        "khata_enabled": True,
        "khata_credit_limit": 10000.0,
        "current_balance": 850.0,
        "address": "Flat 302, Al-Rehman Heights, Saddar, Karachi"
    },
    {
        "customer_id": "c3333333-3333-3333-3333-333333333333",
        "phone_number": "+923334567890",
        "name": "Usman Ali",
        "preferred_language": "en",
        "khata_enabled": False,
        "khata_credit_limit": 0.0,
        "current_balance": 0.0,
        "address": "Plot 78, Sector F-8/2, Islamabad"
    }
]

SAMPLE_RIDERS = [
    {"rider_id": "r1111111-1111-1111-1111-111111111111", "name": "Bilal Ahmed", "phone": "+923121112233", "lat": 31.5204, "lng": 74.3587},
    {"rider_id": "r2222222-2222-2222-2222-222222222222", "name": "Hamza Khan", "phone": "+923154445566", "lat": 31.5280, "lng": 74.3510}
]

async def seed():
    async with AsyncSessionLocal() as session:
        print("🌱 Seeding RetailSpeak AI Database...")
        
        # 1. Seed Store
        await session.execute(text("""
            INSERT INTO stores (store_id, name, address, phone, timezone, rag_similarity_floor, rag_auto_accept_threshold)
            VALUES (:store_id, :name, :address, :phone, 'Asia/Karachi', 0.720, 0.850)
            ON CONFLICT (store_id) DO UPDATE SET name = EXCLUDED.name;
        """), {
            "store_id": DEFAULT_STORE_ID,
            "name": "Al-Madina Super Store & Kiryana",
            "address": "Main Bazar, Near Jamia Masjid, Lahore",
            "phone": "+924235881234"
        })
        print("✅ Store registered.")

        # 2. Seed Products with Embeddings
        print(f"📦 Seeding {len(SAMPLE_PRODUCTS)} products with RAG embeddings...")
        for p in SAMPLE_PRODUCTS:
            embed_source = f"{p['name_en']} | {p['name_ur']} | {p['name_roman_ur']} | {p['aliases']}"
            vector = embed_text(embed_source)
            vector_str = "[" + ",".join(str(v) for v in vector) + "]"
            
            await session.execute(text("""
                INSERT INTO products (
                    store_id, name_en, name_ur, name_roman_ur, aliases,
                    category, unit, price, in_stock_qty, low_stock_threshold,
                    is_active, embedding
                ) VALUES (
                    :store_id, :name_en, :name_ur, :name_roman_ur, :aliases,
                    :category, :unit, :price, :stock, 5,
                    true, CAST(:embedding AS vector)
                ) ON CONFLICT DO NOTHING;
            """), {
                "store_id": DEFAULT_STORE_ID,
                "name_en": p["name_en"],
                "name_ur": p["name_ur"],
                "name_roman_ur": p["name_roman_ur"],
                "aliases": p["aliases"],
                "category": p["category"],
                "unit": p["unit"],
                "price": p["price"],
                "stock": p["stock"],
                "embedding": vector_str
            })
        print("✅ Products & embeddings seeded.")

        # 3. Seed Customers & Khata
        print("👥 Seeding customers & Khata profiles...")
        for c in SAMPLE_CUSTOMERS:
            await session.execute(text("""
                INSERT INTO customers (
                    customer_id, store_id, phone_number, name, preferred_language,
                    khata_enabled, khata_credit_limit, current_balance
                ) VALUES (
                    :customer_id, :store_id, :phone, :name, :lang,
                    :khata_enabled, :limit, :balance
                ) ON CONFLICT (store_id, phone_number) DO UPDATE SET
                    name = EXCLUDED.name,
                    khata_credit_limit = EXCLUDED.khata_credit_limit;
            """), {
                "customer_id": c["customer_id"],
                "store_id": DEFAULT_STORE_ID,
                "phone": c["phone_number"],
                "name": c["name"],
                "lang": c["preferred_language"],
                "khata_enabled": c["khata_enabled"],
                "limit": c["khata_credit_limit"],
                "balance": c["current_balance"]
            })

            await session.execute(text("""
                INSERT INTO customer_addresses (customer_id, address_line, is_default)
                VALUES (:customer_id, :address, true)
                ON CONFLICT DO NOTHING;
            """), {
                "customer_id": c["customer_id"],
                "address": c["address"]
            })

            if c["current_balance"] > 0:
                await session.execute(text("""
                    INSERT INTO khata_entries (
                        customer_id, store_id, entry_type, amount,
                        running_balance_after, note, created_by
                    ) VALUES (
                        :customer_id, :store_id, 'credit_sale', :amount,
                        :balance, 'Opening balance from legacy register', 'owner:manual'
                    ) ON CONFLICT DO NOTHING;
                """), {
                    "customer_id": c["customer_id"],
                    "store_id": DEFAULT_STORE_ID,
                    "amount": c["current_balance"],
                    "balance": c["current_balance"]
                })
        print("✅ Customers & Khata ledgers seeded.")

        # 4. Seed Delivery Riders
        print("🛵 Seeding active delivery riders...")
        for r in SAMPLE_RIDERS:
            await session.execute(text("""
                INSERT INTO riders (rider_id, store_id, name, phone, is_available, current_lat, current_lng)
                VALUES (:rider_id, :store_id, :name, :phone, true, :lat, :lng)
                ON CONFLICT (rider_id) DO NOTHING;
            """), {
                "rider_id": r["rider_id"],
                "store_id": DEFAULT_STORE_ID,
                "name": r["name"],
                "phone": r["phone"],
                "lat": r["lat"],
                "lng": r["lng"]
            })
        print("✅ Riders seeded.")

        await session.commit()
        print("\n🎉 All RetailSpeak AI database fixtures successfully created and embedded!")

if __name__ == "__main__":
    asyncio.run(seed())
