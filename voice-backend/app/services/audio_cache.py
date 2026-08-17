import uuid
from collections import OrderedDict

_cache: "OrderedDict[str, bytes]" = OrderedDict()
_MAX_ITEMS = 200


def store(data: bytes) -> str:
    audio_id = uuid.uuid4().hex
    _cache[audio_id] = data
    while len(_cache) > _MAX_ITEMS:
        _cache.popitem(last=False)
    return audio_id


def get(audio_id: str) -> bytes | None:
    return _cache.get(audio_id)
