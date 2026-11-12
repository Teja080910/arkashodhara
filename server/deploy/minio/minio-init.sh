#!/bin/sh
set -eu
: "${MINIO_ROOT_USER:?}"
: "${MINIO_ROOT_PASSWORD:?}"

echo "waiting for minio"
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  sleep 2
done

make_bucket() {
  name="$1"
  public="$2"
  mc mb --ignore-existing "local/$name"
  if [ "$public" = "public" ]; then
    mc anonymous set download "local/$name"
  else
    mc anonymous set none "local/$name"
  fi
}

make_bucket "$DRAWER_BUCKET" public
make_bucket "$PORTFOLIO_BUCKET" public
make_bucket "$PT_TASK_SCREENSHOTS_BUCKET" private
make_bucket "$PT_AVATARS_BUCKET" public
make_bucket "$PT_DOCS_BUCKET" private
make_bucket "$PT_APKS_BUCKET" public

make_user() {
  user="$1"
  pass="$2"
  bucket="$3"
  write="$4"
  mc admin user add local "$user" "$pass" || true
  if [ "$write" = "rw" ]; then
    actions='s3:GetObject,s3:PutObject,s3:DeleteObject,s3:ListBucket,s3:GetBucketLocation'
  else
    actions='s3:GetObject,s3:ListBucket,s3:GetBucketLocation'
  fi
  cat > "/tmp/policy-$user.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListAllMyBuckets"],
      "Resource": ["arn:aws:s3:::*"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::$bucket"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::$bucket/*"]
    }
  ]
}
EOF
  mc admin policy create "local" "policy-$user" "/tmp/policy-$user.json" >/dev/null 2>&1 || \
    mc admin policy update "local" "policy-$user" "/tmp/policy-$user.json" >/dev/null 2>&1 || true
  mc admin policy attach local "policy-$user" --user "$user" 2>/dev/null || true
}

make_user "$DRAWER_S3_USER" "$DRAWER_S3_PASSWORD" "$DRAWER_BUCKET" rw
make_user "$PORTFOLIO_S3_USER" "$PORTFOLIO_S3_PASSWORD" "$PORTFOLIO_BUCKET" rw
make_user "$PT_S3_USER" "$PT_S3_PASSWORD" "$PT_TASK_SCREENSHOTS_BUCKET" rw

# project-tracker needs 4 buckets under one identity
cat > "/tmp/policy-$PT_S3_USER.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListAllMyBuckets"],
      "Resource": ["arn:aws:s3:::*"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::$PT_TASK_SCREENSHOTS_BUCKET",
        "arn:aws:s3:::$PT_AVATARS_BUCKET",
        "arn:aws:s3:::$PT_DOCS_BUCKET",
        "arn:aws:s3:::$PT_APKS_BUCKET"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::$PT_TASK_SCREENSHOTS_BUCKET/*",
        "arn:aws:s3:::$PT_AVATARS_BUCKET/*",
        "arn:aws:s3:::$PT_DOCS_BUCKET/*",
        "arn:aws:s3:::$PT_APKS_BUCKET/*"
      ]
    }
  ]
}
EOF
mc admin policy create local "policy-$PT_S3_USER" "/tmp/policy-$PT_S3_USER.json" >/dev/null 2>&1 || \
  mc admin policy update local "policy-$PT_S3_USER" "/tmp/policy-$PT_S3_USER.json" >/dev/null 2>&1 || true
mc admin policy attach local "policy-$PT_S3_USER" --user "$PT_S3_USER" 2>/dev/null || true

echo "minio init complete"
