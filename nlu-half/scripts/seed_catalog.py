"""
RetailSpeak AI - realistic seed data for a Lahore kiryana store.
Matches sql/full_schema.sql exactly (products hold stock + embedding, etc.).

- Names are how shoppers SAY them (brand + Roman Urdu). No Urdu script.
- Idempotent: fixed UUIDs + upserts. Re-run is safe and never resets stock/balances.
- PRICES ARE APPROXIMATE - verify against a real store before demos.

Usage:  python -m scripts.seed_catalog
"""
import asyncio
import uuid
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.rag_service import embed_text

STORE_ID = "11111111-1111-1111-1111-111111111111"   # same ID the repo/tests already use
NS = uuid.UUID("12345678-1234-5678-1234-567812345678")
CLEAN_OLD = True   # delete old demo rows (old seed + schema.sql fixtures) not in this file

def uid(*parts) -> str:
    return str(uuid.uuid5(NS, "|".join(parts)))

# (name_en, roman_ur, aliases, category, unit, price_PKR, stock, low_stock_threshold)
P = [
 # Atta / flour
 ("Fauji Atta 10kg", "fauji atta 10 kilo", ["fauji ata", "atta bori", "10kg atta", "aata"], "Flour", "bag", 1450, 40, 10),
 ("Fauji Atta 5kg", "fauji atta 5 kilo", ["fauji ata 5kg", "5kg atta"], "Flour", "bag", 740, 40, 10),
 ("Sunridge Atta 10kg", "sunridge atta", ["sunridge ata", "atta bori"], "Flour", "bag", 1420, 30, 8),
 ("Chakki Atta (loose)", "chakki atta khula", ["atta", "ata", "gandum ka atta", "loose atta"], "Flour", "kg", 135, 300, 50),
 ("Maida 1kg", "maida", ["fine maida", "samosa maida", "white flour"], "Flour", "kg", 160, 60, 15),
 ("Besan 1kg", "besan", ["gram flour", "pakora besan"], "Flour", "kg", 330, 50, 10),
 ("Sooji 1kg", "suji sooji", ["semolina", "halwa suji"], "Flour", "kg", 190, 40, 10),
 # Rice
 ("Guard Basmati Rice 1kg", "guard chawal", ["guard rice", "basmati", "super kernel"], "Rice", "kg", 380, 100, 20),
 ("Guard Basmati Rice 5kg", "guard chawal 5 kilo", ["rice bag", "5kg rice", "family pack chawal"], "Rice", "bag", 1850, 30, 8),
 ("Falak Sella Rice 1kg", "falak sela chawal", ["sella rice", "sela", "biryani chawal"], "Rice", "kg", 340, 80, 20),
 ("Irri-6 Rice (loose)", "chawal khula", ["rice", "chawal", "mota chawal"], "Rice", "kg", 210, 150, 30),
 # Sugar / salt
 ("Sugar (loose)", "cheeni khuli", ["sugar", "chini", "cheeni"], "Essentials", "kg", 165, 300, 50),
 ("Sugar 1kg Packet", "cheeni packet", ["sugar packet", "chini 1kg"], "Essentials", "packet", 170, 100, 20),
 ("National Iodized Salt 800g", "national namak", ["salt", "namak", "iodized salt"], "Essentials", "packet", 60, 120, 25),
 # Oil / ghee
 ("Dalda Banaspati Ghee 1kg", "dalda ghee", ["ghee", "banaspati", "dalda packet"], "Oil & Ghee", "packet", 590, 80, 15),
 ("Dalda Banaspati Ghee 5kg Tin", "dalda ghee 5 kilo dabba", ["ghee tin", "ghee dabba", "5kg ghee"], "Oil & Ghee", "tin", 2850, 25, 5),
 ("Soya Supreme Banaspati 1kg", "soya supreme ghee", ["soya supreme", "ghee"], "Oil & Ghee", "packet", 570, 60, 12),
 ("Habib Cooking Oil 1L", "habib tail", ["habib oil", "cooking oil", "tail"], "Oil & Ghee", "packet", 560, 80, 15),
 ("Eva Cooking Oil 1L", "eva tail", ["eva oil", "cooking oil"], "Oil & Ghee", "packet", 550, 60, 12),
 ("Sufi Cooking Oil 1L", "sufi tail", ["sufi oil", "cooking oil"], "Oil & Ghee", "packet", 555, 60, 12),
 # Dairy / bread / eggs
 ("Nestle MilkPak 1L", "nestle milk pak 1 litre", ["nestle milk", "milkpak", "milk pack", "nestle doodh", "dabba doodh"], "Dairy", "pack", 335, 120, 24),
 ("Nestle MilkPak 500ml", "nestle milk pak aadha litre", ["nestle milk small", "milkpak 500", "nestle milk 500ml"], "Dairy", "pack", 175, 80, 20),
 ("Olper's Milk 1L", "olpers doodh", ["olpers milk", "olper milk", "dabba doodh"], "Dairy", "pack", 345, 100, 24),
 ("Olper's Milk 500ml", "olpers doodh 500", ["olpers small", "olper milk 500ml"], "Dairy", "pack", 180, 60, 15),
 ("Dahi (loose)", "dahi", ["yogurt", "curd", "dahi khula"], "Dairy", "kg", 280, 30, 8),
 ("Nurpur Butter 200g", "nurpur makhan", ["butter", "makhan"], "Dairy", "packet", 420, 30, 8),
 ("Eggs Dozen", "anday dozen", ["anda", "andey", "eggs", "12 anday"], "Dairy", "dozen", 380, 60, 12),
 ("Egg (single)", "anda ek", ["single egg", "ek anda"], "Dairy", "pcs", 33, 120, 24),
 ("Dawn Bread Large", "dawn double roti", ["bread", "double roti", "dawn bread"], "Bakery", "pcs", 150, 30, 8),
 ("Bread Small", "chhoti double roti", ["small bread", "roti"], "Bakery", "pcs", 90, 30, 8),
 # Tea
 ("Tapal Danedar Tea 430g", "tapal danedar chai", ["tapal", "danedar", "chai patti", "chai"], "Tea", "packet", 960, 50, 10),
 ("Lipton Yellow Label Tea 430g", "lipton chai", ["lipton tea", "yellow label", "lipton", "chai"], "Tea", "packet", 980, 45, 10),
 ("Vital Tea 430g", "vital chai", ["vital tea", "vital", "chai"], "Tea", "packet", 900, 40, 10),
 ("Supreme Tea 430g", "supreme chai", ["supreme tea", "chai"], "Tea", "packet", 920, 30, 8),
 ("Lipton Tea Sachet", "lipton chai sachet", ["lipton sachet", "tea sachet"], "Tea", "pcs", 20, 200, 40),
 # Spices / masala
 ("Shan Bombay Biryani Masala", "shan biryani masala", ["shan biryani", "biryani masala", "biryani packet"], "Spices", "packet", 150, 120, 25),
 ("Shan Korma Masala", "shan qorma masala", ["shan korma", "korma masala"], "Spices", "packet", 150, 80, 20),
 ("Shan Nihari Masala", "shan nihari", ["nihari masala"], "Spices", "packet", 150, 60, 15),
 ("National Biryani Masala", "national biryani masala", ["national biryani"], "Spices", "packet", 140, 60, 15),
 ("National Lal Mirch Powder 200g", "national lal mirch", ["red chilli", "mirch", "lal mirch powder"], "Spices", "packet", 250, 70, 15),
 ("National Haldi Powder 100g", "national haldi", ["haldi", "turmeric"], "Spices", "packet", 120, 70, 15),
 ("Dhaniya Powder 100g", "dhania powder", ["coriander powder", "dhaniya"], "Spices", "packet", 110, 50, 12),
 ("Garam Masala 50g", "garam masala", ["garam masala powder"], "Spices", "packet", 120, 50, 12),
 ("Knorr Noodles Chicken", "knorr noodles", ["knorr", "noodles"], "Packaged Food", "packet", 70, 100, 24),
 ("Maggi Noodles", "maggi noodles", ["maggi", "noodles"], "Packaged Food", "packet", 70, 100, 24),
 ("National Tomato Ketchup 800g", "national ketchup", ["ketchup", "sauce"], "Packaged Food", "bottle", 380, 30, 8),
 # Daal / pulses (loose)
 ("Daal Chana (loose)", "daal chana", ["chana daal", "dal chana"], "Pulses", "kg", 290, 80, 15),
 ("Daal Masoor (loose)", "daal masoor", ["masoor daal", "dal masur", "red daal"], "Pulses", "kg", 300, 70, 15),
 ("Daal Moong (loose)", "daal moong", ["moong daal", "dal mung"], "Pulses", "kg", 330, 60, 15),
 ("Daal Mash (loose)", "daal mash", ["mash daal", "dal maash"], "Pulses", "kg", 420, 50, 12),
 ("Safaid Chana (loose)", "safaid chanay", ["kabuli chana", "cholay", "chickpeas"], "Pulses", "kg", 380, 60, 15),
 ("Lobia (loose)", "lobia", ["black eyed peas", "lobiya"], "Pulses", "kg", 350, 40, 10),
 # Fresh veg (loose)
 ("Onion (loose)", "pyaz", ["piyaz", "onion"], "Vegetables", "kg", 90, 100, 20),
 ("Potato (loose)", "aloo", ["aalu", "potato"], "Vegetables", "kg", 80, 100, 20),
 ("Tomato (loose)", "tamatar", ["tomato", "tamater"], "Vegetables", "kg", 120, 60, 15),
 # Drinks
 ("Pepsi 1.5L", "pepsi bari", ["pepsi", "pepsi bottle", "cold drink"], "Beverages", "bottle", 200, 80, 20),
 ("Coca-Cola 1.5L", "coke bari", ["coke", "coca cola", "cold drink"], "Beverages", "bottle", 200, 80, 20),
 ("Sprite 1.5L", "sprite bari", ["sprite", "cold drink"], "Beverages", "bottle", 200, 70, 18),
 ("Sprite 1L", "sprite 1 litre", ["sprite", "sprite chhoti", "cold drink"], "Beverages", "bottle", 140, 60, 15),
 ("7UP 1.5L", "7up bari", ["7up", "seven up", "cold drink"], "Beverages", "bottle", 200, 60, 15),
 ("Fanta 1.5L", "fanta bari", ["fanta", "orange drink"], "Beverages", "bottle", 200, 50, 12),
 ("Mountain Dew 1.5L", "dew bari", ["dew", "mountain dew"], "Beverages", "bottle", 200, 50, 12),
 ("Pakola Ice Cream Soda 1.5L", "pakola bari", ["pakola", "green soda"], "Beverages", "bottle", 190, 40, 10),
 ("Nestle Pure Life Water 1.5L", "nestle pani", ["pani", "water bottle", "mineral water"], "Beverages", "bottle", 100, 100, 24),
 ("Rooh Afza 800ml", "rooh afza", ["roohafza", "sharbat", "red sharbat"], "Beverages", "bottle", 520, 40, 10),
 # Snacks / biscuits
 ("Lays Masala 50g", "lays masala", ["lays", "chips", "masala chips"], "Snacks", "packet", 100, 100, 24),
 ("Kurkure Chutney Chaska", "kurkure", ["kurkure", "chutney chips"], "Snacks", "packet", 50, 120, 24),
 ("LU Prince Biscuit Family Pack", "prince biscuit", ["prince", "chocolate biscuit", "lu prince"], "Snacks", "pack", 200, 50, 12),
 ("Peek Freans Sooper Pack", "sooper biscuit", ["sooper", "peek freans", "egg biscuit"], "Snacks", "pack", 60, 100, 24),
 ("Bisconni Chocolate Chip", "bisconni choco chip", ["choco chip", "bisconni"], "Snacks", "pack", 80, 60, 15),
 # Household / personal care
 ("Surf Excel 1kg", "surf excel", ["surf", "washing powder", "kapray dhone ka powder"], "Household", "packet", 640, 50, 12),
 ("Bonus Tristar 1kg", "bonus tristar", ["bonus", "washing powder"], "Household", "packet", 430, 50, 12),
 ("Vim Dishwash Bar", "vim bar", ["vim", "bartan sabun", "dish soap"], "Household", "pcs", 60, 80, 20),
 ("Harpic Toilet Cleaner 500ml", "harpic", ["toilet cleaner"], "Household", "bottle", 400, 30, 8),
 ("Lux Soap", "lux sabun", ["lux", "bath soap", "sabun"], "Personal Care", "pcs", 130, 120, 30),
 ("Lifebuoy Soap", "lifebuoy sabun", ["lifebuoy", "sabun"], "Personal Care", "pcs", 125, 120, 30),
 ("Safeguard Soap", "safeguard sabun", ["safeguard", "sabun"], "Personal Care", "pcs", 135, 100, 25),
 ("Dettol Soap 100g", "dettol sabun", ["dettol", "antibacterial soap"], "Personal Care", "pcs", 150, 80, 20),
 ("Head & Shoulders Sachet", "head and shoulders sachet", ["shampoo sachet", "h&s"], "Personal Care", "pcs", 15, 200, 50),
]

MAX_ORDER = {"kg": 50, "bag": 10, "tin": 5, "dozen": 10, "pack": 24, "bottle": 24, "packet": 24, "pcs": 48}

# (name, phone, lang, khata_limit(0=off), opening_balance, address, lat, lng)
C = [
 ("Muhammad Tariq", "+923000000001", "ur", 15000, 2350, "House 14-B, Street 3, Gulberg II, Lahore", 31.5204, 74.3587),
 ("Fatima Bibi", "+923000000002", "ur", 10000, 850, "Flat 302, Al-Rehman Heights, Gulberg III, Lahore", 31.5160, 74.3500),
 ("Usman Ali", "+923000000003", "en", 0, 0, "House 78, Block F, Model Town, Lahore", 31.4830, 74.3270),
 ("Ayesha Khan", "+923000000004", "roman_ur", 8000, 0, "House 22, Street 9, Garden Town, Lahore", 31.5010, 74.3290),
 ("Rashid Mehmood", "+923000000005", "ur", 20000, 6400, "Shop 5, Main Market, Gulberg II, Lahore", 31.5210, 74.3570),
 ("Saima Naz", "+923000000006", "ur", 5000, 1200, "House 41, Block C, Faisal Town, Lahore", 31.4800, 74.3050),
 ("Bilal Hussain", "+923000000007", "roman_ur", 0, 0, "Flat 12, Gulberg Heights, Lahore", 31.5180, 74.3540),
 ("Zainab Iqbal", "+923000000008", "en", 12000, 0, "House 9, Street 4, Johar Town, Lahore", 31.4697, 74.2728),
 ("Hafiz Imran", "+923000000009", "ur", 25000, 11800, "House 63, Block A, Model Town, Lahore", 31.4850, 74.3250),
 ("Nasreen Akhtar", "+923000000010", "ur", 6000, 3100, "House 30, Gulberg III, Lahore", 31.5140, 74.3480),
 ("Kamran Sheikh", "+923000000011", "roman_ur", 10000, 0, "House 5, Street 12, Garden Town, Lahore", 31.5000, 74.3310),
 ("Sadia Rehman", "+923000000012", "en", 0, 0, "House 18, Block B, Faisal Town, Lahore", 31.4790, 74.3070),
]

# (name, phone, lat, lng)
R = [
 ("Bilal Ahmed", "+923000000101", 31.5204, 74.3587),
 ("Hamza Khan", "+923000000102", 31.5280, 74.3510),
 ("Adeel Raza", "+923000000103", 31.5150, 74.3440),
]


async def seed():
    async with AsyncSessionLocal() as s:
        print("Seeding RetailSpeak AI...")

        # Safety: make sure columns exist even if the DB was created from the shorter schema.sql
        for stmt in [
            "ALTER TABLE stores ADD COLUMN IF NOT EXISTS address TEXT",
            "ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone VARCHAR(32)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(64) NOT NULL DEFAULT 'general'",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 5",
        ]:
            await s.execute(text(stmt))

        # 1. Store
        await s.execute(text("""
            INSERT INTO stores (store_id, name, address, phone, timezone)
            VALUES (CAST(:id AS uuid), :name, :addr, :phone, 'Asia/Karachi')
            ON CONFLICT (store_id) DO UPDATE SET
                name = EXCLUDED.name, address = EXCLUDED.address, phone = EXCLUDED.phone"""),
            {"id": STORE_ID, "name": "Al-Madina Super Store & Kiryana",
             "addr": "Main Bazar, Gulberg, Lahore", "phone": "+924235881234"})

        # 2. Products (+ one 384-dim embedding each; stock is never overwritten on re-run)
        product_ids = []
        for name_en, roman, aliases, cat, unit, price, stock, low in P:
            pid = uid("product", name_en)
            product_ids.append(pid)
            alias_str = ", ".join(aliases)
            vec = embed_text(f"{name_en} | {roman} | {alias_str}")
            vec_str = "[" + ",".join(str(v) for v in vec) + "]"
            await s.execute(text("""
                INSERT INTO products (product_id, store_id, name_en, name_ur, name_roman_ur, aliases,
                    category, unit, price, in_stock_qty, low_stock_threshold, max_order_qty,
                    is_active, embedding)
                VALUES (CAST(:id AS uuid), CAST(:sid AS uuid), :en, NULL, :ro, :al,
                    :cat, :unit, :price, :stock, :low, :maxq, true, CAST(:emb AS vector))
                ON CONFLICT (product_id) DO UPDATE SET
                    name_roman_ur = EXCLUDED.name_roman_ur, aliases = EXCLUDED.aliases,
                    category = EXCLUDED.category, unit = EXCLUDED.unit, price = EXCLUDED.price,
                    low_stock_threshold = EXCLUDED.low_stock_threshold,
                    max_order_qty = EXCLUDED.max_order_qty, embedding = EXCLUDED.embedding,
                    is_active = true, updated_at = now()"""),
                {"id": pid, "sid": STORE_ID, "en": name_en, "ro": roman, "al": alias_str,
                 "cat": cat, "unit": unit, "price": price, "stock": stock, "low": low,
                 "maxq": MAX_ORDER.get(unit, 24), "emb": vec_str})
        print(f"{len(P)} products + embeddings done")

        # 3. Customers, addresses, khata opening balances
        customer_ids = []
        for name, phone, lang, limit, bal, addr, lat, lng in C:
            cid = uid("customer", phone)
            customer_ids.append(cid)
            await s.execute(text("""
                INSERT INTO customers (customer_id, store_id, phone_number, name, preferred_language,
                    khata_enabled, khata_credit_limit, current_balance)
                VALUES (CAST(:id AS uuid), CAST(:sid AS uuid), :ph, :name, :lang, :ke, :lim, :bal)
                ON CONFLICT (store_id, phone_number) DO UPDATE SET
                    name = EXCLUDED.name, preferred_language = EXCLUDED.preferred_language,
                    khata_enabled = EXCLUDED.khata_enabled, khata_credit_limit = EXCLUDED.khata_credit_limit"""),
                {"id": cid, "sid": STORE_ID, "ph": phone, "name": name, "lang": lang,
                 "ke": limit > 0, "lim": limit, "bal": bal})
            await s.execute(text("""
                INSERT INTO customer_addresses (address_id, customer_id, label, address_line,
                    latitude, longitude, is_default)
                VALUES (CAST(:aid AS uuid), CAST(:cid AS uuid), 'Home', :addr, :lat, :lng, true)
                ON CONFLICT (address_id) DO NOTHING"""),
                {"aid": uid("address", phone), "cid": cid, "addr": addr, "lat": lat, "lng": lng})
            if bal > 0:
                await s.execute(text("""
                    INSERT INTO khata_entries (entry_id, customer_id, store_id, entry_type, amount,
                        running_balance_after, note, created_by)
                    VALUES (CAST(:eid AS uuid), CAST(:cid AS uuid), CAST(:sid AS uuid), 'adjustment',
                        :amt, :amt, 'Opening balance from paper register', 'owner:manual')
                    ON CONFLICT (entry_id) DO NOTHING"""),
                    {"eid": uid("khata-open", cid), "cid": cid, "sid": STORE_ID, "amt": bal})
        print(f"{len(C)} customers done")

        # 4. Riders
        rider_ids = []
        for name, phone, lat, lng in R:
            rid = uid("rider", phone)
            rider_ids.append(rid)
            await s.execute(text("""
                INSERT INTO riders (rider_id, store_id, name, phone, is_available, current_lat, current_lng)
                VALUES (CAST(:id AS uuid), CAST(:sid AS uuid), :name, :ph, true, :lat, :lng)
                ON CONFLICT (rider_id) DO UPDATE SET
                    name = EXCLUDED.name, phone = EXCLUDED.phone"""),
                {"id": rid, "sid": STORE_ID, "name": name, "ph": phone, "lat": lat, "lng": lng})
        print(f"{len(R)} riders done")

        # 5. Remove leftovers from the old seed / schema.sql test fixtures (dev only)
        if CLEAN_OLD:
            for table, key, ids in [("products", "product_id", product_ids),
                                    ("customers", "customer_id", customer_ids),
                                    ("riders", "rider_id", rider_ids)]:
                await s.execute(text(
                    f"DELETE FROM {table} WHERE store_id = CAST(:sid AS uuid) "
                    f"AND {key} <> ALL(CAST(:ids AS uuid[]))"),
                    {"sid": STORE_ID, "ids": ids})
            print("Old demo rows removed")

        await s.commit()
        print("Done. Next: python -m scripts.verify_database")


if __name__ == "__main__":
    asyncio.run(seed())
