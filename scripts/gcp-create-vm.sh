#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE_NAME="${INSTANCE_NAME:-guardian-agent-vm}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-small}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Set PROJECT_ID first. Example:"
  echo "PROJECT_ID=tough-country-506812-u0 ./scripts/gcp-create-vm.sh"
  exit 1
fi

gcloud config set project "$PROJECT_ID"

gcloud compute instances create "$INSTANCE_NAME" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_TYPE" \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-balanced \
  --scopes=https://www.googleapis.com/auth/cloud-platform

echo "Created VM:"
echo "  project: $PROJECT_ID"
echo "  instance: $INSTANCE_NAME"
echo "  zone: $ZONE"
echo ""
echo "SSH with:"
echo "gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
