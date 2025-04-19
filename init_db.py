import sqlite3

# Connect to database (it will create it if it doesn't exist)
conn = sqlite3.connect('nss_data.db')

# Create a cursor to interact with the database
cursor = conn.cursor()

# Create a simple table called "users" as an example
cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        credits INTEGER DEFAULT 0
    )
''')

# Save changes and close connection
conn.commit()
conn.close()

print("Database and table created!")
