import pytest

from backend import create_app


@pytest.fixture()
def app(tmp_path):
    app = create_app(
        {
            "TESTING": True,
            "DATABASE": str(tmp_path / "test.db"),
            "SECRET_KEY": "test-secret-key",
            "ADMIN_USERNAME": "admin",
            "ADMIN_PASSWORD": "admin123",
            "SEED_DEMO_DATA": False,
        }
    )
    yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def login(client, username, password):
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def admin_token(client):
    return login(client, "admin", "admin123")["token"]


def register_user(client, username="learner", password="secret123"):
    response = client.post(
        "/api/auth/register", json={"username": username, "password": password}
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def create_subject(client, token, name="科目一", description="测试科目"):
    response = client.post(
        "/api/admin/subjects",
        headers=auth(token),
        json={"name": name, "description": description, "sort_order": 1},
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["subject"]


def create_question(client, token, subject_id, qtype, content, options, answer, explanation=""):
    response = client.post(
        "/api/admin/questions",
        headers=auth(token),
        json={
            "subject_id": subject_id,
            "qtype": qtype,
            "content": content,
            "options": options,
            "answer": answer,
            "explanation": explanation,
        },
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["question"]


def seed_exam_questions(client, token, subject_id):
    single = create_question(
        client,
        token,
        subject_id,
        "single",
        "红灯表示什么？",
        ["通行", "禁止通行", "减速", "鸣笛"],
        ["B"],
        "红灯禁止通行。",
    )
    multiple = create_question(
        client,
        token,
        subject_id,
        "multiple",
        "雨天应该怎么做？",
        ["降低车速", "增大车距", "急刹车", "开启远光灯"],
        ["A", "B"],
        "雨天路滑应降低车速并增大车距。",
    )
    judge = create_question(
        client,
        token,
        subject_id,
        "judge",
        "高速公路可以倒车。",
        None,
        ["F"],
        "高速公路严禁倒车。",
    )
    expected = {
        single["id"]: single["answer"],
        multiple["id"]: multiple["answer"],
        judge["id"]: judge["answer"],
    }
    return [single, multiple, judge], expected


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_register_login_and_me(client):
    data = register_user(client)
    assert data["user"]["username"] == "learner"
    assert data["user"]["role"] == "user"
    assert "password" not in data["user"]

    me = client.get("/api/auth/me", headers=auth(data["token"]))
    assert me.status_code == 200
    assert me.get_json()["user"]["username"] == "learner"

    duplicate = client.post(
        "/api/auth/register", json={"username": "learner", "password": "another123"}
    )
    assert duplicate.status_code == 409

    wrong = client.post(
        "/api/auth/login", json={"username": "learner", "password": "badpass"}
    )
    assert wrong.status_code == 401

    invalid = client.post(
        "/api/auth/register", json={"username": "a b", "password": "123"}
    )
    assert invalid.status_code == 422


def test_site_settings(client):
    public = client.get("/api/settings")
    assert public.status_code == 200
    assert public.get_json()["settings"]["site_name"] == "知考"

    user = register_user(client)
    forbidden = client.patch(
        "/api/admin/settings",
        headers=auth(user["token"]),
        json={"site_name": "新名称", "site_description": "新介绍"},
    )
    assert forbidden.status_code == 403

    token = admin_token(client)
    updated = client.patch(
        "/api/admin/settings",
        headers=auth(token),
        json={"site_name": "智慧考试平台", "site_description": "全新的网站介绍。"},
    )
    assert updated.status_code == 200
    assert updated.get_json()["settings"]["site_name"] == "智慧考试平台"

    public = client.get("/api/settings")
    assert public.get_json()["settings"]["site_description"] == "全新的网站介绍。"

    invalid = client.patch(
        "/api/admin/settings",
        headers=auth(token),
        json={"site_name": ""},
    )
    assert invalid.status_code == 422


def test_update_profile_nickname_and_password(client):
    data = register_user(client)
    token = data["token"]

    updated = client.patch(
        "/api/auth/profile", headers=auth(token), json={"nickname": "小明"}
    )
    assert updated.status_code == 200
    assert updated.get_json()["user"]["nickname"] == "小明"

    wrong = client.patch(
        "/api/auth/profile",
        headers=auth(token),
        json={"current_password": "badpass", "new_password": "newsecret123"},
    )
    assert wrong.status_code == 400

    changed = client.patch(
        "/api/auth/profile",
        headers=auth(token),
        json={"current_password": "secret123", "new_password": "newsecret123"},
    )
    assert changed.status_code == 200

    old_login = client.post(
        "/api/auth/login", json={"username": "learner", "password": "secret123"}
    )
    assert old_login.status_code == 401

    new_login = login(client, "learner", "newsecret123")
    me = client.get("/api/auth/me", headers=auth(new_login["token"]))
    assert me.status_code == 200
    assert me.get_json()["user"]["nickname"] == "小明"


def test_admin_permissions_and_user_management(client):
    user = register_user(client)
    forbidden = client.get("/api/admin/users", headers=auth(user["token"]))
    assert forbidden.status_code == 403

    token = admin_token(client)
    created = client.post(
        "/api/admin/users",
        headers=auth(token),
        json={
            "username": "manager",
            "password": "manager123",
            "role": "admin",
            "is_active": True,
        },
    )
    assert created.status_code == 201
    manager = created.get_json()["user"]

    updated = client.patch(
        f"/api/admin/users/{manager['id']}",
        headers=auth(token),
        json={"role": "user", "is_active": False},
    )
    assert updated.status_code == 200
    assert updated.get_json()["user"]["role"] == "user"
    assert updated.get_json()["user"]["is_active"] is False

    blocked = client.post(
        "/api/auth/login", json={"username": "manager", "password": "manager123"}
    )
    assert blocked.status_code == 403

    self_deactivate = client.patch(
        "/api/admin/users/1", headers=auth(token), json={"is_active": False}
    )
    assert self_deactivate.status_code == 400

    users = client.get("/api/admin/users", headers=auth(token))
    assert users.status_code == 200
    assert len(users.get_json()["items"]) >= 3


def test_subject_and_question_crud(client):
    token = admin_token(client)
    subject = create_subject(client, token)
    assert subject["question_count"] == 0

    question = create_question(
        client,
        token,
        subject["id"],
        "single",
        "选择题测试",
        ["选项一", "选项二", "选项三"],
        ["B"],
        "解析",
    )
    assert question["answer"] == ["B"]
    assert question["options"][0] == {"key": "A", "text": "选项一"}

    listed = client.get(
        f"/api/admin/questions?subject_id={subject['id']}&type=single",
        headers=auth(token),
    )
    assert listed.status_code == 200
    assert listed.get_json()["total"] == 1

    updated = client.patch(
        f"/api/admin/questions/{question['id']}",
        headers=auth(token),
        json={"content": "更新后的题目", "answer": ["C"]},
    )
    assert updated.status_code == 200
    assert updated.get_json()["question"]["content"] == "更新后的题目"
    assert updated.get_json()["question"]["answer"] == ["C"]

    invalid = client.post(
        "/api/admin/questions",
        headers=auth(token),
        json={
            "subject_id": subject["id"],
            "qtype": "single",
            "content": "缺少答案",
            "options": ["A", "B"],
            "answer": [],
        },
    )
    assert invalid.status_code == 422

    deleted = client.delete(
        f"/api/admin/questions/{question['id']}", headers=auth(token)
    )
    assert deleted.status_code == 200
    listed_after = client.get(
        f"/api/admin/questions?subject_id={subject['id']}", headers=auth(token)
    )
    assert listed_after.get_json()["total"] == 0

    subjects = client.get("/api/subjects", headers=auth(token))
    assert subjects.status_code == 200
    assert subjects.get_json()["items"][0]["question_count"] == 0

    deleted_subject = client.delete(
        f"/api/admin/subjects/{subject['id']}", headers=auth(token)
    )
    assert deleted_subject.status_code == 200
    assert client.get("/api/subjects", headers=auth(token)).get_json()["items"] == []


def test_exam_flow_stats_and_wrong_questions(client):
    token = admin_token(client)
    subject = create_subject(client, token)
    questions, expected = seed_exam_questions(client, token, subject["id"])

    learner = register_user(client)
    headers = auth(learner["token"])

    too_many = client.post(
        "/api/exams/start",
        headers=headers,
        json={"subject_id": subject["id"], "question_count": 99},
    )
    assert too_many.status_code == 422

    started = client.post(
        "/api/exams/start",
        headers=headers,
        json={"subject_id": subject["id"], "question_count": 3},
    )
    assert started.status_code == 201
    payload = started.get_json()
    attempt = payload["attempt"]
    assert attempt["status"] == "in_progress"
    assert len(payload["questions"]) == 3
    for question in payload["questions"]:
        assert "answer" not in question
        assert "explanation" not in question

    first_question = payload["questions"][0]
    progress = client.patch(
        f"/api/exams/{attempt['id']}/progress",
        headers=headers,
        json={"answers": {str(first_question["id"]): [first_question["options"][0]["key"]]}},
    )
    assert progress.status_code == 200
    fetched = client.get(f"/api/exams/{attempt['id']}", headers=headers)
    progress_question = next(
        item
        for item in fetched.get_json()["questions"]
        if item["id"] == first_question["id"]
    )
    assert progress_question["selected"] == [first_question["options"][0]["key"]]

    answers = {}
    for index, question in enumerate(payload["questions"]):
        if index == 0:
            answers[str(question["id"])] = expected[question["id"]]
        else:
            wrong_key = next(
                option["key"]
                for option in question["options"]
                if option["key"] not in expected[question["id"]]
            )
            answers[str(question["id"])] = [wrong_key]

    submitted = client.post(
        f"/api/exams/{attempt['id']}/submit", headers=headers, json={"answers": answers}
    )
    assert submitted.status_code == 200
    result = submitted.get_json()
    assert result["attempt"]["status"] == "submitted"
    assert result["attempt"]["correct_count"] == 1
    assert result["attempt"]["score"] == pytest.approx(33.33)
    for question in result["questions"]:
        assert "answer" in question
        assert "explanation" in question
        assert "is_correct" in question

    duplicate_submit = client.post(
        f"/api/exams/{attempt['id']}/submit", headers=headers, json={"answers": {}}
    )
    assert duplicate_submit.status_code == 409

    other = register_user(client, username="other", password="secret456")
    forbidden_detail = client.get(
        f"/api/exams/{attempt['id']}", headers=auth(other["token"])
    )
    assert forbidden_detail.status_code == 404

    history = client.get("/api/exams", headers=headers)
    assert history.status_code == 200
    assert history.get_json()["total"] == 1

    wrong = client.get("/api/wrong-questions", headers=headers)
    assert wrong.status_code == 200
    assert wrong.get_json()["total"] == 2
    assert all("answer" in item for item in wrong.get_json()["items"])

    summary = client.get("/api/stats/summary", headers=headers)
    assert summary.status_code == 200
    stats = summary.get_json()["stats"]
    assert stats["total_exams"] == 1
    assert stats["total_answered"] == 3
    assert stats["total_correct"] == 1
    assert stats["wrong_question_count"] == 2
    assert stats["wrong_rate"] == pytest.approx(66.7)
    assert summary.get_json()["subjects"][0]["attempts"] == 1


def test_subject_delete_hides_questions_but_keeps_attempts(client):
    token = admin_token(client)
    subject = create_subject(client, token)
    seed_exam_questions(client, token, subject["id"])
    learner = register_user(client)
    headers = auth(learner["token"])

    started = client.post(
        "/api/exams/start",
        headers=headers,
        json={"subject_id": subject["id"], "question_count": 1},
    )
    attempt = started.get_json()["attempt"]
    assert attempt["total_questions"] == 1

    deleted = client.delete(f"/api/admin/subjects/{subject['id']}", headers=auth(token))
    assert deleted.status_code == 200
    assert client.get("/api/subjects", headers=headers).get_json()["items"] == []

    history = client.get("/api/exams", headers=headers)
    assert history.get_json()["total"] == 1
    assert history.get_json()["items"][0]["subject_name"] == subject["name"]

    detail = client.get(f"/api/exams/{attempt['id']}", headers=headers)
    assert detail.status_code == 200
    assert len(detail.get_json()["questions"]) == 1
