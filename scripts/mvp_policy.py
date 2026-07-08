"""Single-admin internal MVP run policy.

This module keeps internal status markers consistent across status, prompt
generation, and ingest. It does not change BUILD-SPEC human gates; it only
records when a local engineering run is an internal artifact rather than a
production/public launch.
"""

APPROVED_STATUSES = {"approved", "reference"}


def _has_flag(obj, key):
    return isinstance(obj, dict) and obj.get(key) is True


def track_has_internal_marker(track):
    if not track:
        return False
    if track.get("smoke_note") or track.get("temporary_smoke_note"):
        return True
    if _has_flag(track, "mvp_internal_only") or _has_flag(track, "smoke_only") or _has_flag(track, "needs_human_review"):
        return True
    for value in track.values():
        if isinstance(value, dict) and (
            _has_flag(value, "mvp_internal_only")
            or _has_flag(value, "smoke_only")
            or _has_flag(value, "needs_human_review")
        ):
            return True
    return False


def track_review_flags(track):
    status = (track or {}).get("status") or "draft"
    internal_marker = track_has_internal_marker(track)
    formal = status in APPROVED_STATUSES and not internal_marker
    needs_review = not formal
    return {
        "needs_human_review": needs_review,
        "formal_approval": formal,
        "mvp_internal_only": needs_review,
    }


def track_review_status(track):
    flags = track_review_flags(track)
    status = (track or {}).get("status") or "draft"
    review = {
        **flags,
        "track_id": (track or {}).get("track_id"),
        "track_status": status,
    }
    if flags["needs_human_review"]:
        review["reason"] = (
            "track status is not formal approved/reference"
            if status not in APPROVED_STATUSES
            else "track is marked as smoke/internal only"
        )
    return review


def track_warning(track):
    review = track_review_status(track)
    if not review["needs_human_review"]:
        return None
    return (
        f"⚠️ MVP internal run only: track {review.get('track_id')} "
        f"status={review.get('track_status')}; needs_human_review=true; "
        "formal_approval=false; mvp_internal_only=true. "
        "This is an internal artifact, not production sync or public launch."
    )


def account_can_run(account):
    return bool((account or {}).get("account_id"))


def account_is_internal_test(account):
    return bool(
        (account or {}).get("mvp_internal_test") is True
        or (account or {}).get("internal_test") is True
    )


def account_block_message(account):
    return (
        f"账号「{(account or {}).get('display_name') or (account or {}).get('account_id')}」"
        "缺少 account_id，不能跑批。"
    )


def annotate_output(output, flags):
    return {
        **output,
        "needs_human_review": flags["needs_human_review"],
        "formal_approval": flags["formal_approval"],
        "mvp_internal_only": flags["mvp_internal_only"],
    }


def annotate_today(today, track, account):
    review = track_review_status(track)
    flags = {k: review[k] for k in ("needs_human_review", "formal_approval", "mvp_internal_only")}
    board = today.get("board") or {}
    annotated_board = {
        key: [annotate_output(item, flags) for item in board.get(key, [])]
        for key in ("picks", "also_ran", "skipped")
    }
    return {
        **today,
        **flags,
        "review_status": {
            **review,
            "account_id": (account or {}).get("account_id"),
        },
        "board": annotated_board,
    }


def run_note_text(account_id, date_str, review):
    return "\n".join([
        "# MVP Internal Run Note",
        "",
        f"Date: {date_str}",
        f"Account: `{account_id}`",
        f"Track: `{review.get('track_id')}`",
        f"Track status: `{review.get('track_status')}`",
        "",
        "This run is for local single-admin MVP engineering validation only.",
        "",
        "- needs_human_review: true",
        "- formal_approval: false",
        "- mvp_internal_only: true",
        "- not BUILD-SPEC human-gate completion",
        "- not production sync",
        "- not public launch",
        "- installed only through `scripts/ingest.py`",
        "",
    ])
