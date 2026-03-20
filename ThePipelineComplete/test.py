import pandas as pd
from pathlib import Path

# Relative path from your root Final directory
file_path = Path("C:\\Uni\\S26\\Senior\\Final\\subject_level_final.csv")

if file_path.exists():
    # nrows=0 ensures we don't load the whole dataset into RAM
    df = pd.read_csv(file_path, nrows=0)
    col_count = len(df.columns)
    
    print(f"✅ Success! File: {file_path}")
    print(f"📊 Total Columns: {col_count}")
    print("-" * 30)
    print(f"First 5 Columns: {list(df.columns[:5])} ...")
else:
    print(f"❌ Error: Could not find '{file_path}'")
    print(f"Current working directory is: {Path.cwd()}")