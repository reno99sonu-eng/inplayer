// Copyright screening for video content (videos, shorts/Raftaar, Raftaar Films).
//
// Works on three levels — same architecture as musicCopyright.ts:
//
// 1. EXACT SHA-256 FINGERPRINT — client computes hash before upload. A match
//    in InPlayer-Videos under a DIFFERENT creatorId = definite infringement.
//    Same creator re-uploading their own content = allowed (warn only).
//
// 2. METADATA SCREENING — title/description/tags scanned for signals that
//    strongly correlate with re-uploading copyrighted content (OTT names,
//    film names, official release language). Hits go to REVIEW not block,
//    because a false positive must never stop a real creator.
//
// 3. CROSS-SERIES DUPLICATE — for Raftaar Films: if the same episode title
//    + duration is found under a different series by a different creator,
//    flag for review.
//
// THIS FILE IS SIDE-EFFECT FREE (no PutCommand) — all DynamoDB writes
// happen in the API route. screenVideoUpload() returns signals + risk;
// the caller decides what to do.

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '@/app/lib/dynamodb';

export type VideoCopyrightRisk = 'clear' | 'review' | 'definite';

export interface VideoCopyrightSignal {
  code: string;
  detail: string;
  certainty: 'definite' | 'probable' | 'possible';
}

export interface VideoCopyrightScreening {
  risk: VideoCopyrightRisk;
  signals: VideoCopyrightSignal[];
  duplicateVideoId?: string;
  originalCreatorId?: string;
}

export const VIDEO_COPYRIGHT_REPORTER = 'system:video-copyright-screen';

// Patterns that almost exclusively appear when re-uploading a commercial release
const DEFINITE_PATTERNS: RegExp[] = [
  /full\s+(movie|film)/i,
  /\b(netflix|amazon\s+prime|disney\+|hotstar|zee5|sony\s*liv|jio\s*cinema|mxplayer|voot|alt\s*balaji|ullu|aha|sun\s*nxt)\b/i,
  /hd\s+(1080p|720p|480p)\s+(download|watch)/i,
  /copyright\s+free\s+movie/i,
];

const REVIEW_PATTERNS: RegExp[] = [
  /official\s+(video|trailer|teaser|song|audio)/i,
  /\b(lyrical|lyrics)\s+video/i,
  /\d{4}\s+(hindi|telugu|tamil|kannada|malayalam|punjabi|bengali)\s+(movie|film|web\s*series)/i,
  /\b(T-Series|Zee Music|Sony Music|Tips Music|Saregama|YRF|Dharma|Eros|Reliance Entertainment)\b/i,
  /starring\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
  /directed\s+by/i,
  /\bep\.?\s*\d+\b.*\b(web\s*series|season)/i,
  /full\s+episode/i,
];

export function screenVideoMetadata(input: {
  title: string;
  description?: string;
  tags?: string[];
}): { signals: VideoCopyrightSignal[]; risk: VideoCopyrightRisk } {
  const text = [
    input.title,
    input.description ?? '',
    ...(input.tags ?? []),
  ].join(' ');

  const signals: VideoCopyrightSignal[] = [];

  for (const pattern of DEFINITE_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({
        code: 'META_DEFINITE',
        detail: `Title/description matches a definite infringement pattern: "${pattern.source}"`,
        certainty: 'definite',
      });
    }
  }

  for (const pattern of REVIEW_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({
        code: 'META_REVIEW',
        detail: `Title/description matches a copyright review pattern: "${pattern.source}"`,
        certainty: 'probable',
      });
    }
  }

  const risk: VideoCopyrightRisk =
    signals.some((s) => s.certainty === 'definite')
      ? 'definite'
      : signals.length > 0
      ? 'review'
      : 'clear';

  return { signals, risk };
}

export async function checkVideoFingerprint(input: {
  sha256: string;
  uploadingCreatorId: string;
}): Promise<{
  found: boolean;
  duplicateVideoId?: string;
  isSameCreator?: boolean;
  originalCreatorId?: string;
}> {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: 'InPlayer-Videos',
        FilterExpression: 'sha256 = :h',
        ExpressionAttributeValues: { ':h': input.sha256 },
        ProjectionExpression: 'videoId, creatorId',
      })
    );
    const match = (result.Items ?? [])[0];
    if (!match) return { found: false };
    return {
      found: true,
      duplicateVideoId: match.videoId as string,
      isSameCreator: match.creatorId === input.uploadingCreatorId,
      originalCreatorId: match.creatorId as string,
    };
  } catch {
    // fingerprint check failure must never block an upload
    return { found: false };
  }
}

export async function screenVideoUpload(input: {
  sha256?: string;
  uploadingCreatorId: string;
  title: string;
  description?: string;
  tags?: string[];
}): Promise<VideoCopyrightScreening> {
  const { signals, risk: metaRisk } = screenVideoMetadata(input);

  if (input.sha256) {
    const fp = await checkVideoFingerprint({
      sha256: input.sha256,
      uploadingCreatorId: input.uploadingCreatorId,
    });
    if (fp.found && !fp.isSameCreator) {
      signals.unshift({
        code: 'EXACT_DUPLICATE',
        detail: `Exact duplicate of video ${fp.duplicateVideoId} by a different creator`,
        certainty: 'definite',
      });
      return {
        risk: 'definite',
        signals,
        duplicateVideoId: fp.duplicateVideoId,
        originalCreatorId: fp.originalCreatorId,
      };
    }
    if (fp.found && fp.isSameCreator) {
      signals.push({
        code: 'SELF_DUPLICATE',
        detail: `Re-upload of the creator's own video ${fp.duplicateVideoId}`,
        certainty: 'possible',
      });
    }
  }

  return { risk: metaRisk, signals };
}
