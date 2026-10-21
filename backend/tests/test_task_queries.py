from datetime import date, timedelta


def _create(client, headers, title, **extra):
    resp = client.post("/tasks", json={"title": title, **extra}, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _titles(client, headers, query=""):
    resp = client.get(f"/tasks?{query}", headers=headers)
    assert resp.status_code == 200, resp.text
    return [t["title"] for t in resp.json()["items"]]


def test_filter_by_priority(client, alice):
    _create(client, alice, "alta", priority="HIGH")
    _create(client, alice, "baixa", priority="LOW")
    assert _titles(client, alice, "priority=HIGH") == ["alta"]


def test_filter_by_due_date_range(client, alice):
    _create(client, alice, "cedo", due_date="2026-11-01")
    _create(client, alice, "meio", due_date="2026-11-15")
    _create(client, alice, "tarde", due_date="2026-12-01")
    _create(client, alice, "sem prazo")
    assert _titles(client, alice, "due_after=2026-11-10&due_before=2026-11-30&sort=due_date&order=asc") == ["meio"]
    assert set(_titles(client, alice, "due_before=2026-11-15")) == {"cedo", "meio"}


def test_overdue_excludes_done_and_future(client, alice):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    _create(client, alice, "atrasada", due_date=yesterday)
    _create(client, alice, "concluida", due_date=yesterday, status="DONE")
    _create(client, alice, "futura", due_date=tomorrow)
    assert _titles(client, alice, "overdue=true") == ["atrasada"]


def test_sort_by_due_date_puts_missing_last(client, alice):
    _create(client, alice, "sem prazo")
    _create(client, alice, "b", due_date="2026-11-20")
    _create(client, alice, "a", due_date="2026-11-10")
    assert _titles(client, alice, "sort=due_date&order=asc") == ["a", "b", "sem prazo"]
    assert _titles(client, alice, "sort=due_date&order=desc") == ["b", "a", "sem prazo"]


def test_sort_by_priority_uses_importance_not_alphabet(client, alice):
    _create(client, alice, "m", priority="MEDIUM")
    _create(client, alice, "l", priority="LOW")
    _create(client, alice, "h", priority="HIGH")
    assert _titles(client, alice, "sort=priority&order=desc") == ["h", "m", "l"]


def test_sort_by_title(client, alice):
    for title in ("c", "a", "b"):
        _create(client, alice, title)
    assert _titles(client, alice, "sort=title&order=asc") == ["a", "b", "c"]


def test_pagination_keeps_total(client, alice):
    for i in range(5):
        _create(client, alice, f"t{i}")
    page = client.get("/tasks?limit=2&offset=2&sort=title&order=asc", headers=alice).json()
    assert page["total"] == 5
    assert [t["title"] for t in page["items"]] == ["t2", "t3"]


def test_invalid_sort_is_validation_error(client, alice):
    resp = client.get("/tasks?sort=password", headers=alice)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_user_cannot_use_owner_filter_to_see_others(client, alice, bob):
    _create(client, bob, "do bob")
    bob_id = client.get("/auth/me", headers=bob).json()["id"]
    assert _titles(client, alice, f"owner_id={bob_id}") == []


def test_stats_for_user_cover_only_own_tasks(client, alice, bob):
    _create(client, alice, "a1", status="DONE", priority="HIGH")
    _create(client, alice, "a2")
    _create(client, bob, "b1")
    stats = client.get("/tasks/stats", headers=alice).json()
    assert stats["total"] == 2
    assert stats["by_status"] == {"PENDING": 1, "IN_PROGRESS": 0, "DONE": 1}
    assert stats["by_priority"]["HIGH"] == 1
    assert stats["by_owner"] is None


def test_stats_for_admin_include_owners(client, alice, bob, admin):
    _create(client, alice, "a1", status="DONE")
    _create(client, alice, "a2")
    _create(client, bob, "b1", status="IN_PROGRESS")
    stats = client.get("/tasks/stats", headers=admin).json()
    assert stats["total"] == 3
    owners = {o["owner_name"]: o for o in stats["by_owner"]}
    assert owners["alice"]["total"] == 2 and owners["alice"]["by_status"]["DONE"] == 1
    assert owners["bob"]["by_status"]["IN_PROGRESS"] == 1


def test_stats_count_overdue(client, alice):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    _create(client, alice, "atrasada", due_date=yesterday)
    _create(client, alice, "ok", due_date=yesterday, status="DONE")
    assert client.get("/tasks/stats", headers=alice).json()["overdue"] == 1
