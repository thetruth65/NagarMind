"""
Run this ONCE to set CORS on your R2 bucket.
  pip install boto3
  python set_r2_cors.py
"""
import boto3
from botocore.config import Config

CF_R2_ACCOUNT_ID      = "9d0adaac8f1e650acfa75f190b3f09ad"
CF_R2_ACCESS_KEY_ID   = "c0c2afcb6dc1803cda75e476e5f18d4a"
CF_R2_SECRET_ACCESS_KEY = "3a0abadfc5281c12d497237a84f851f02ec1ffd52e286fb3988822a78118364e"
CF_R2_BUCKET_NAME     = "nagarmind-photos"

client = boto3.client(
    "s3",
    endpoint_url=f"https://{CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=CF_R2_ACCESS_KEY_ID,
    aws_secret_access_key=CF_R2_SECRET_ACCESS_KEY,
    region_name="weur",
    config=Config(signature_version="s3v4"),
)

cors_config = {
    "CORSRules": [
        {
            "AllowedOrigins": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3600,
        }
    ]
}

client.put_bucket_cors(Bucket=CF_R2_BUCKET_NAME, CORSConfiguration=cors_config)
print("✅ R2 CORS set successfully")

# Verify
resp = client.get_bucket_cors(Bucket=CF_R2_BUCKET_NAME)
print("Current CORS rules:", resp["CORSRules"])