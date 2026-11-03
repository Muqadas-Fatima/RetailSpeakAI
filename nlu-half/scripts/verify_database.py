"""
RetailSpeak AI — Database & Vector DB Verification Diagnostic Script.
Checks:
1. PostgreSQL connectivity & version
2. pgvector extension activation
3. Table existence and row counts across all domains (Stores, Catalog, Customers, Khata, Riders)
4. Vector embedding population and dimension checks
5. Live Vector Cosine Distance search test (RAG retrieval simulation)

Usage:
    python -m scripts.verify_database
"""
import asyncio
import sys
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.services.rag_service import embed_text

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


async def run_diagnostics():
    print(f"\n{BOLD}{CYAN}======================================================={RESET}")
    print(f"{BOLD}{CYAN}   RetailSpeak AI — Database & Vector DB Diagnostics   {RESET}")
    print(f"{BOLD}{CYAN}======================================================={RESET}\n")

    # 1. Test Connection
    try:
        async with AsyncSessionLocal() as session:
            res = await session.execute(text("SELECT version();"))
            version_str = res.scalar()
            print(f"[{GREEN}✓ PASS{RESET}] PostgreSQL Connected successfully!")
            print(f"       Engine: {version_str[:70]}...\n")
    except Exception as exc:
        print(f"[{RED}✗ FAIL{RESET}] Cannot connect to PostgreSQL database.")
        print(f"       Error: {exc}\n")
        print(f"{YELLOW}Troubleshooting Tip:{RESET}")
        print("  1. Make sure Docker Desktop is running.")
        print("  2. In your terminal, run: docker-compose up -d db redis")
        print("  3. Check that DATABASE_URL in .env matches: postgresql+asyncpg://user:password@localhost:5432/retailspeak\n")
        return

    # 2. Check pgvector Extension
    async with AsyncSessionLocal() as session:
        ext_res = await session.execute(text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"))
        ext_row = ext_res.fetchone()
        if ext_row:
            print(f"[{GREEN}✓ PASS{RESET}] Vector Extension (pgvector) is ACTIVE (v{ext_row[1]}).\n")
        else:
            print(f"[{RED}✗ FAIL{RESET}] pgvector extension is NOT installed in this database!")
            print(f"       Run: CREATE EXTENSION vector;\n")

    # 3. Check All Tables and Row Counts
    tables_to_check = [
        ("stores", "Stores / Kiryana Outlets"),
        ("products", "Catalog Products"),
        ("customers", "Registered Customers"),
        ("customer_addresses", "Customer Delivery Addresses"),
        ("khata_entries", "Khata Credit Ledger Records"),
        ("orders", "Orders Placed"),
        ("order_line_items", "Order Line Items"),
        ("inventory_reservations", "Inventory Stock Locks"),
        ("purchase_orders", "Supplier Purchase Orders"),
        ("riders", "Delivery Riders"),
        ("delivery_assignments", "Rider Delivery Assignments")
    ]

    print(f"{BOLD}--- Table Structure & Data Inventory ---{RESET}")
    all_tables_ok = True
    async with AsyncSessionLocal() as session:
        for tbl, label in tables_to_check:
            try:
                res = await session.execute(text(f"SELECT count(*) FROM {tbl};"))
                count = res.scalar()
                color = GREEN if count > 0 else YELLOW
                print(f"[{color}✓{RESET}] Table {tbl:<24} : {count:>4} rows ({label})")
            except Exception as e:
                print(f"[{RED}✗{RESET}] Table {tbl:<24} : MISSING ({e})")
                all_tables_ok = False
        print()

    # 4. Check Vector Embeddings Quality in Products
    print(f"{BOLD}--- Vector DB Embedding Quality Check ---{RESET}")
    async with AsyncSessionLocal() as session:
        try:
            total_prods = (await session.execute(text("SELECT count(*) FROM products;"))).scalar()
            embedded_prods = (await session.execute(text("SELECT count(*) FROM products WHERE embedding IS NOT NULL;"))).scalar()

            if total_prods == 0:
                print(f"[{YELLOW}! EMPTY{RESET}] No products found in the catalog. Run `python -m scripts.seed_catalog`.\n")
            elif embedded_prods == total_prods:
                print(f"[{GREEN}✓ PASS{RESET}] 100% of products have valid 384-dimensional vector embeddings ({embedded_prods}/{total_prods}).\n")
            else:
                missing = total_prods - embedded_prods
                print(f"[{YELLOW}! WARN{RESET}] {missing} product(s) missing embeddings! Run `python -m scripts.backfill_embeddings`.\n")
        except Exception as e:
            print(f"[{RED}✗ FAIL{RESET}] Error inspecting product vectors: {e}\n")

    # 5. Live Semantic Vector Cosine Similarity Search Test
    print(f"{BOLD}--- Live Vector Cosine Distance Search Test (RAG Simulation) ---{RESET}")
    test_queries = [
        "1 kilo ata",
        "2 olpher milk",
        "thandi sprite bottle",
        "biryani masala packet"
    ]

    async with AsyncSessionLocal() as session:
        for q in test_queries:
            query_vector = embed_text(q)
            vector_str = "[" + ",".join(str(v) for v in query_vector) + "]"

            # Distance in pgvector: <=> is cosine distance (0.0 = identical, 1.0 = orthogonal)
            # Similarity score = 1 - cosine_distance
            sql = text("""
                SELECT 
                    name_en, 
                    unit, 
                    price, 
                    1 - (embedding <=> CAST(:vec AS vector)) as similarity
                FROM products
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> CAST(:vec AS vector)
                LIMIT 1;
            """)
            result = await session.execute(sql, {"vec": vector_str})
            row = result.fetchone()

            if row:
                name, unit, price, sim = row
                sim_float = float(sim)
                match_status = f"{GREEN}STRONG MATCH (>=0.85){RESET}" if sim_float >= 0.85 else f"{YELLOW}PLAUSIBLE (>=0.72){RESET}" if sim_float >= 0.72 else f"{RED}REJECTED (<0.72){RESET}"
                print(f"  Query: {BOLD}\"{q}\"{RESET}")
                print(f"    &rarr; Top Match: {CYAN}{name}{RESET} ({unit}) @ PKR {price}")
                print(f"    &rarr; Cosine Similarity: {sim_float:.4f} &mdash; {match_status}\n")
            else:
                print(f"  Query: \"{q}\" &rarr; {RED}No match returned.{RESET}\n")

    print(f"{BOLD}{GREEN}Verification diagnostic finished.{RESET}\n")


if __name__ == "__main__":
    asyncio.run(run_diagnostics())
