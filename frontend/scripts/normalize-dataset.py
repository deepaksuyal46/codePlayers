"""Rebuild shipped normalized data: py -3 scripts/normalize-dataset.py (no packages)."""
from pathlib import Path
import csv,json,hashlib
from decimal import Decimal
root=Path(__file__).resolve().parents[1]
def read(name):
    with (root/'data/source'/name).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
products=read('products.csv'); sellers=read('sellers.csv'); categories=read('categories.csv'); navigation=read('navigation.csv')
seller_map={s['name']:s for s in sellers}
rows=[]
for r in products:
    assert r['availability'] in ['In Stock','Limited Stock','Out of Stock']
    price=Decimal(r['discounted_price'])*100
    assert price==price.to_integral_value() and price>=0
    rows.append(dict(sku=r['product_id'],slug=r['product_id'].lower().replace('_','-'),title=r['title'],category=r['category'],description=r['description'],pricePaise=int(price),image=r['image_url'],imageLite='/products/dataset-placeholder.svg',color='#eee5dc',initialStock={'In Stock':20,'Limited Stock':3,'Out of Stock':0}[r['availability']],demo=True,source='bundled-meesho-sample',catalogue=dict(brand=r['brand'],subcategory=r['subcategory'],rating=float(r['rating']),reviewCount=int(r['review_count']),originalPricePaise=int(Decimal(r['original_price'])*100),sellerName=r['seller_name'],sellerLocation=seller_map.get(r['seller_name'],{}).get('location'),material=r['material'],sizes=r['sizes_available'],returnPolicy=r['return_policy'],deliveryTime=r['delivery_time'],availabilityLabel=r['availability']),sourceRecord=r))
assert len({r['sku'] for r in rows})==len(rows)
refs=[dict(kind=k,sourceId=r[idkey],record=r) for k,records,idkey in [('category',categories,'category_id'),('seller',sellers,'seller_id'),('navigation',navigation,'nav_id')] for r in records]
for name,records in [('dataset-products.json',rows),('dataset-references.json',refs)]:
    (root/'data'/name).write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report=dict(products=len(rows),productCategories=len({r['category'] for r in rows}),categoryRecords=len(categories),sellerRecords=len(sellers),navigationRecords=len(navigation),unmatchedSellerNames=sum(r['seller_name'] not in seller_map for r in products),outOfStock=sum(r['initialStock']==0 for r in rows),sourceHashes={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((root/'data/source').glob('*.csv'))})
(root/'data/dataset-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
