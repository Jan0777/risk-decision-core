import json
import pyspark.sql.functions as F
from pyspark.sql import SparkSession
from pyspark.sql.types import StringType, StructType, StructField

# Initialize Spark Session
spark = SparkSession.builder \
    .appName("PolicySimulationBatch") \
    .getOrCreate()

# In a real environment, this would read from Parquet/Iceberg
# df = spark.read.parquet("s3://bucket/applicant_data_seed.parquet")
# For demonstration, we create a dummy dataframe if run locally
data = [
    (5000, 1.33, 0.10, 13, 202565, 48, 750, 700, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
    (44480, 1.17, 0.23, 3, 42451, 48, 650, 520, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
    (12751, 1.38, 1.10, 13, 170249, 84, 650, 650, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2)
]
columns = [
    "requested_amount", "ltv_ratio", "projected_di", "age_of_vehicle", "vehicle_mileage", "term",
    "custom_score", "primary_applicant_primary_score", "num_bankruptcies", "foreclosures", 
    "repossessions", "charge_offs", "tax_liens", "collection_balance", "30dpd_24m", 
    "60dpd_24m", "90dpd_24m", "num_inquiries"
]
df = spark.createDataFrame(data, columns)

def build_spark_condition(cond):
    lhs = F.col(cond['lhs'])
    op = cond['operator']
    if op == 'is None':
        return lhs.isNull()
    elif op == 'is Not None':
        return lhs.isNotNull()
    
    rhs = F.lit(cond['rhs'])
    if op == '<': return lhs < rhs
    elif op == '<=': return lhs <= rhs
    elif op == '==': return lhs == rhs
    elif op == '>=': return lhs >= rhs
    elif op == '>': return lhs > rhs
    elif op == '!=': return lhs != rhs
    return F.lit(False)

def apply_logic(conditions, logic):
    if not conditions:
        return F.lit(True)
    exprs = [build_spark_condition(c) for c in conditions]
    combined = exprs[0]
    for expr in exprs[1:]:
        if logic == 'AND':
            combined = combined & expr
        else:
            combined = combined | expr
    return combined

# We would normally load the JSON spec here
# with open('policy.json', 'r') as f: policy = json.load(f)
# Here we represent the translation concept directly.

# Gate 1: Hard Rules Segment Logic
g1_s1_cond = F.col("custom_score").isNull() | F.col("primary_applicant_primary_score").isNull()
g1_s2_cond = F.col("custom_score").isNotNull() & (F.col("custom_score") > 680)
g1_s3_cond = F.col("custom_score").isNotNull() & (F.col("custom_score") > 600) & (F.col("custom_score") <= 680)
g1_s4_cond = F.col("custom_score").isNotNull() & (F.col("custom_score") <= 600)

g1_s2_rules = F.col("primary_applicant_primary_score") >= 550
g1_s3_rules = (
    (F.col("primary_applicant_primary_score") >= 550) &
    (F.col("num_bankruptcies") == 0) &
    (F.col("foreclosures") == 0) & (F.col("repossessions") == 0) & (F.col("charge_offs") == 0) & 
    (F.col("tax_liens") == 0) & (F.col("collection_balance") <= 500) &
    (F.col("30dpd_24m") <= 1) & (F.col("60dpd_24m") == 0) & (F.col("90dpd_24m") == 0) &
    (F.col("num_inquiries") <= 3) &
    (F.col("projected_di") <= 0.80)
)
g1_s4_rules = F.lit(False)

gate1_passed = F.when(g1_s1_cond, True) \
               .when(g1_s2_cond, g1_s2_rules) \
               .when(g1_s3_cond, g1_s3_rules) \
               .when(g1_s4_cond, g1_s4_rules) \
               .otherwise(False)


# Gate 2: Soft Rules Segment Logic
g2_s1_cond = g1_s1_cond
g2_s2_cond = g1_s2_cond
g2_s3_cond = g1_s3_cond

g2_s1_rules = F.lit(False) # goes to manual review
g2_s2_rules = (F.col("age_of_vehicle") <= 9) & (F.col("vehicle_mileage") <= 150000) & (F.col("term") <= 84)
g2_s3_rules = (
    (F.col("num_open_trades") >= 3) &
    (F.col("age_of_vehicle") <= 6) & (F.col("vehicle_mileage") <= 150000) & (F.col("term") <= 84) &
    (F.col("ltv_ratio") <= 1.35) & (F.col("projected_di") <= 1.0)
)

gate2_passed = F.when(g2_s1_cond, g2_s1_rules) \
                .when(g2_s2_cond, g2_s2_rules) \
                .when(g2_s3_cond, g2_s3_rules) \
                .otherwise(False)

final_decision = F.when(~gate1_passed, F.lit("AUTO_DENIAL")) \
                  .when(~gate2_passed, F.lit("MANUAL_REVIEW")) \
                  .otherwise(F.lit("AUTO_APPROVAL"))

df_decisioned = df.withColumn("final_decision", final_decision)
df_decisioned.select("requested_amount", "final_decision").show()

print("PySpark simulation completed. Ready for production batch writing.")
