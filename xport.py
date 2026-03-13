from supabase import create_client, Client

url = "https://qtqpnpnckqedsllitkjr.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0cXBucG5ja3FlZHNsbGl0a2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjExNzQsImV4cCI6MjA4ODEzNzE3NH0.bQJIfTNYAyskNWoYHRQ1VV5bOp9QB3jfEHM7IAx9auQ"
supabase: Client = create_client(url, key)

# Execute the query in batches of 1000
try:
    filename = "customers.csv"
    batch_size = 1000
    start = 0
    all_rows_fetched = 0
    
    with open(filename, "w", encoding="utf-8") as f:
        while True:
            # Fetch a range of records
            response = supabase.table('customers').select("*").range(start, start + batch_size - 1).csv().execute()
            batch_data = response.data
            
            if not batch_data or batch_data.strip() == "":
                break
            
            lines = batch_data.strip().split("\n")
            
            # For the first batch, write everything (including header)
            # For later batches, skip the first line (header)
            if start == 0:
                f.write(batch_data.strip() + "\n")
                num_records = len(lines) - 1
            else:
                if len(lines) > 1:
                    f.write("\n".join(lines[1:]) + "\n")
                    num_records = len(lines) - 1
                else:
                    num_records = 0

            all_rows_fetched += num_records
            print(f"Fetched {all_rows_fetched} records...")

            # If we got fewer records than requested, we've reached the end
            if num_records < batch_size:
                break
                
            start += batch_size
    
    print(f"Successfully exported {all_rows_fetched} total records to {filename}")
except Exception as e:
    print(f"Error: {e}")


