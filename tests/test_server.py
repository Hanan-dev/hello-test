import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen as request_urlopen
from unittest.mock import patch

import server
from server import NewsFeedHandler, merge_category_articles, requested_categories


class RequestedCategoriesTests(unittest.TestCase):
    def test_reads_and_deduplicates_personalized_categories(self):
        categories = requested_categories({
            "categories": ["technology,business", "technology"],
        })

        self.assertEqual(categories, ["technology", "business"])

    def test_preserves_single_category_api_compatibility(self):
        self.assertEqual(requested_categories({"category": ["science"]}), ["science"])

    def test_defaults_to_general_category(self):
        self.assertEqual(requested_categories({}), ["general"])

    def test_rejects_unsupported_categories(self):
        with self.assertRaises(ValueError):
            requested_categories({"categories": ["technology,unknown"]})


class MergeCategoryArticlesTests(unittest.TestCase):
    def test_tags_articles_deduplicates_and_sorts_by_publication_date(self):
        merged = merge_category_articles(
            ["technology", "business"],
            [
                {
                    "totalResults": 2,
                    "articles": [
                        {"url": "https://news.test/shared", "publishedAt": "2026-10-30T10:00:00Z"},
                        {"url": "https://news.test/tech", "publishedAt": "2026-10-31T10:00:00Z"},
                    ],
                },
                {
                    "totalResults": 2,
                    "articles": [
                        {"url": "https://news.test/shared", "publishedAt": "2026-10-30T10:00:00Z"},
                        {"url": "https://news.test/business", "publishedAt": "2026-11-01T10:00:00Z"},
                    ],
                },
            ],
        )

        self.assertEqual(merged["status"], "ok")
        self.assertEqual(merged["totalResults"], 4)
        self.assertEqual(
            [(article["url"], article["category"]) for article in merged["articles"]],
            [
                ("https://news.test/business", "business"),
                ("https://news.test/tech", "technology"),
                ("https://news.test/shared", "technology"),
            ],
        )

    def test_limits_merged_articles(self):
        articles = [
            {"url": "https://news.test/{}".format(index), "publishedAt": "2026-11-01T00:00:00Z"}
            for index in range(60)
        ]

        merged = merge_category_articles(["technology"], [{"articles": articles}])

        self.assertEqual(len(merged["articles"]), 50)


class PersonalizedNewsEndpointTests(unittest.TestCase):
    def test_fetches_and_merges_each_requested_category(self):
        requests = []

        class FakeResponse:
            status = 200

            def __init__(self, payload):
                self.payload = payload

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return json.dumps(self.payload).encode("utf-8")

        def fake_urlopen(request, timeout):
            category = parse_qs(urlparse(request.full_url).query)["category"][0]
            requests.append(category)
            return FakeResponse({
                "status": "ok",
                "totalResults": 1,
                "articles": [{
                    "url": "https://news.test/{}".format(category),
                    "title": "{} headline".format(category),
                    "publishedAt": "2026-11-01T10:00:00Z",
                }],
            })

        http_server = ThreadingHTTPServer(("127.0.0.1", 0), NewsFeedHandler)
        server_thread = threading.Thread(target=http_server.serve_forever)
        server_thread.start()
        try:
            with patch.dict(os.environ, {"NEWSAPI_KEY": "test-key"}), patch(
                "server.urlopen", side_effect=fake_urlopen
            ):
                url = "http://127.0.0.1:{}/api/news?country=us&categories=technology%2Cscience".format(
                    http_server.server_address[1]
                )
                with request_urlopen(url, timeout=5) as response:
                    payload = json.loads(response.read().decode("utf-8"))
        finally:
            http_server.shutdown()
            http_server.server_close()
            server_thread.join()

        self.assertCountEqual(requests, ["technology", "science"])
        self.assertCountEqual(
            [article["category"] for article in payload["articles"]],
            ["technology", "science"],
        )


if __name__ == "__main__":
    unittest.main()
