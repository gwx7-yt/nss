from json import JSONDecodeError
from operator import attrgetter
from typing import Any, Iterable, Mapping, Optional, TypeVar

import attr
import httpx
from cachetools import TTLCache

from nepse.errors import APIError

T = TypeVar("T")


@attr.frozen
class _ClientWrapperHTTPX:
    _client: httpx.AsyncClient
    _payload_ids: Mapping[int, int] = TTLCache(2, 500)

    async def _fetch_payload_id(self) -> int:
        payload_id = (await self._get_json("http://nepse-payload-id.samrid.me/")).get(
            "payload_id"
        )

        self._payload_ids[0] = payload_id
        return payload_id

    async def _get_payload_id(self) -> int:
        payload_id = self._payload_ids.get(0)

        if not payload_id:
            payload_id = await self._fetch_payload_id()

        return payload_id

    async def _get_json(self, url: str) -> object:
        try:
            return (await self._client.get(url)).json()
        except JSONDecodeError:
            raise APIError()

    # Created this cause NEPSE API requires POST request
    # with `{"id": <some number>}` in body.
    async def _post_json_defualt_body(self, url: str) -> object:
        payload_id = await self._get_payload_id()
        value = (await self._client.post(url, json={"id": payload_id})).json()

        if value == []:
            payload_id = await self._fetch_payload_id()
            value = (await self._client.post(url, json={"id": payload_id})).json()

        return value

    async def _post_json(self, url: str, body: dict) -> object:
        return (await self._client.post(url, json=body)).json()


def get(iterable: Iterable[T], **attrs: Any) -> Optional[T]:
    """A helper that returns the first element in the iterable that meets
    all the traits passed in ``attrs``.

    Args:
        iterable (Iterable): An iterable to search through.
        **attrs (Any): Keyword arguments that denote attributes to search with.
    """
    attrget = attrgetter

    # Special case the single element call
    if len(attrs) == 1:
        k, v = attrs.popitem()
        pred = attrget(k.replace("__", "."))
        for elem in iterable:
            if pred(elem) == v:
                return elem
        return None

    converted = [
        (attrget(attr.replace("__", ".")), value) for attr, value in attrs.items()
    ]

    for elem in iterable:
        if all(pred(elem) == value for pred, value in converted):
            return elem
    return None
