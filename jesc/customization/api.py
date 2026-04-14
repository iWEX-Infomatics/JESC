import frappe

@frappe.whitelist()
def get_jesc_items(search=None, page=1):

    page = int(page)
    page_size = 20
    start = (page - 1) * page_size

    conditions = ""
    values = {}

    if search and search.strip():

        words = search.strip().split()
        word_conditions = []

        for idx, word in enumerate(words):
            key = f"word_{idx}"
            values[key] = f"%{word}%"
            word_conditions.append(f"""
                (
                    item_code   LIKE %({key})s OR
                    item_name   LIKE %({key})s OR
                    description LIKE %({key})s OR
                    item_group  LIKE %({key})s
                )
            """)

        conditions = "WHERE " + " AND ".join(word_conditions)

    items = frappe.db.sql(f"""
        SELECT item_code, item_name, description, item_group, selling_rate, uom
        FROM `tabJESC Items`
        {conditions}
        ORDER BY item_group, item_name
        LIMIT {start}, {page_size}
    """, values, as_dict=True)

    # Total count
    total_count = frappe.db.sql(f"""
        SELECT COUNT(*) as count
        FROM `tabJESC Items`
        {conditions}
    """, values)[0][0]

    total_pages = (total_count // page_size) + (1 if total_count % page_size else 0)

    return {
        "items": items,
        "total_pages": total_pages,
        "total_count": total_count
    }