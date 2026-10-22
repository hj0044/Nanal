#!/usr/bin/env python3
"""Nanal art pack quality gate. Free/Pillow-only; fail closed for release.

The technical gate checks composition properties but cannot certify visual quality.
The release gate also requires a human-reviewed approval record for 8 bust/full pairs (16 images).

Usage:
  python tools/validate_identity_pack.py /path/to/Nanal_IdentityLocked_16_Technical_v4
  python tools/validate_identity_pack.py /path/to/pack --release
"""
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
from PIL import Image
import numpy as np

GENDERS=('female','male')
VARIANTS=((1,1),(1,2),(2,1),(2,2))
EXPECTED=8

def run(pack: Path, release: bool) -> dict:
    errors=[]; warnings=[]; tests=[]
    results=[]
    for g in GENDERS:
        im_path=pack/'layers'/f'{g}_identity_base.png'
        mask_path=pack/'layers'/f'{g}_face_core_mask.png'
        if not im_path.exists() or not mask_path.exists():
            errors.append(f'{g}: identity base/mask missing');continue
        base=np.array(Image.open(im_path).convert('RGBA'))
        roi=np.array(Image.open(mask_path).convert('L'))>=128
        if base.shape!=(1024,1024,4) or roi.shape!=(1024,1024):
            errors.append(f'{g}: invalid 1024x1024 identity geometry');continue
        if int(np.count_nonzero(roi))<2000:
            errors.append(f'{g}: empty/suspicious face-protection region')
        a={}
        for h,o in VARIANTS:
            key=f'{g}_H{h}_O{o}'
            bpath=pack/'bust'/f'{key}.png'; fpath=pack/'full'/f'{key}.png'
            if not bpath.exists() or not fpath.exists():
                errors.append(f'{key}: missing bust/full');continue
            bi=np.array(Image.open(bpath).convert('RGBA'))
            fi=Image.open(fpath)
            if bi.shape!=(1024,1024,4):errors.append(f'{key}: wrong bust shape {bi.shape}')
            if fi.size!=(1024,1536):errors.append(f'{key}: wrong full size {fi.size}')
            if bi.shape==base.shape:
                changed=int(np.count_nonzero(np.any(bi[roi]!=base[roi],axis=-1)))
                tests.append({'id':key,'faceCorePixelChanges':changed,'faceCorePixelCount':int(roi.sum())})
                if changed:errors.append(f'{key}: face core changed {changed} px')
                a[(h,o)]=bi
            results.append(key)
        if all(k in a for k in VARIANTS):
            for h in (1,2):
                d=int(np.count_nonzero(np.any(a[(h,1)]!=a[(h,2)],axis=2)))
                if d<15000:errors.append(f'{g} H{h}: outfit changes too little ({d}px)')
            for o in (1,2):
                d=int(np.count_nonzero(np.any(a[(1,o)]!=a[(2,o)],axis=2)))
                if d<5000:errors.append(f'{g} O{o}: hair changes too little ({d}px)')
    if len(results)!=EXPECTED:errors.append(f'expected {EXPECTED} bust+full pairs, found {len(results)}')
    report_path=pack/'qa-report.json'
    if report_path.exists():
        report=json.loads(report_path.read_text(encoding='utf-8'))
        if report.get('status')!='APPROVED':
            warnings.append('source package self-identifies as NOT_APPROVED')
            if release: errors.append('release BLOCKED: QA report is not APPROVED')
    else:errors.append('missing QA report')
    approved_path=pack/'human-approval.json'
    if release:
        if not approved_path.exists():errors.append('release BLOCKED: missing human-approval.json')
        else:
            signed=json.loads(approved_path.read_text(encoding='utf-8'))
            approved=set(signed.get('approvedIds',[]))
            if approved!=set(results):errors.append('release BLOCKED: human approval must cover exactly all 16 variants')
            if not signed.get('reviewer') or not signed.get('reviewedAt'):
                errors.append('release BLOCKED: reviewer / reviewedAt absent')
            if signed.get('visualQuality')!='PASS':errors.append('release BLOCKED: illustration quality must be PASS')
            known_hashes=signed.get('fileSha256',{})
            for person in results:
                for view in ('bust','full'):
                    relative=f'{view}/{person}.png'
                    file_path=pack/relative
                    checksum=hashlib.sha256(file_path.read_bytes()).hexdigest()
                    if known_hashes.get(relative)!=checksum:
                        errors.append('release BLOCKED: missing/mismatching SHA-256 '+relative)
    return {'technicalPass':not errors,'releaseRequested':release,'assetPairs':len(results),
            'faceTests':tests,'errors':errors,'warnings':warnings,
            'important':'Pixel comparison validates a protected face ROI only; it never proves haircut realism or full-body artistic consistency.'}

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('pack',type=Path)
    ap.add_argument('--release',action='store_true')
    args=ap.parse_args()
    report=run(args.pack,args.release)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    sys.exit(0 if report['technicalPass'] else 1)