import pandas as pd
df = pd.read_csv("path/to/scan_level_enriched.csv")
l_cols = [c for c in df.columns if c.startswith("L_")]
print(l_cols[:5])