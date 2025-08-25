#!/bin/bash
cd "/Applications/Rhine's Apps/codecrucible-synth"
echo "read package.json" | node dist/index.js 2>&1 | grep -E "(EVIDENCE COLLECTION CHECK|EVIDENCE COLLECTED|EVIDENCE VALIDATION|toolResultSuccess)" | head -20