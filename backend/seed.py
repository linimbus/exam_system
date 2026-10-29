import json

from werkzeug.security import generate_password_hash


DEMO_SUBJECTS = [
    {
        "name": "科目一",
        "description": "道路交通安全法律、法规和相关知识",
        "sort_order": 1,
        "questions": [
            {
                "qtype": "single",
                "content": "机动车驾驶人在道路上驾驶机动车时，应当随身携带的证件是？",
                "options": ["身份证", "机动车驾驶证", "车辆购置税完税证明", "机动车保险单"],
                "answer": ["B"],
                "explanation": "驾驶机动车上道路行驶，应当随身携带机动车驾驶证。",
            },
            {
                "qtype": "single",
                "content": "交通信号灯红灯亮时，表示什么？",
                "options": ["准许通行", "禁止通行", "注意观察后通行", "只准右转"],
                "answer": ["B"],
                "explanation": "红灯亮时表示禁止通行，车辆应在停止线以外停车等待。",
            },
            {
                "qtype": "single",
                "content": "在高速公路上行驶，最低时速不得低于多少公里？",
                "options": ["40 公里", "50 公里", "60 公里", "80 公里"],
                "answer": ["C"],
                "explanation": "机动车在高速公路上行驶，最低车速不得低于每小时 60 公里。",
            },
            {
                "qtype": "multiple",
                "content": "下列哪些行为属于危险驾驶行为？",
                "options": ["醉酒驾驶机动车", "追逐竞驶情节恶劣", "按规定使用安全带", "严重超员载客"],
                "answer": ["A", "B", "D"],
                "explanation": "醉酒驾驶、追逐竞驶以及严重超员等行为都会严重危害道路安全；规范使用安全带是安全行为。",
            },
            {
                "qtype": "multiple",
                "content": "雨天驾驶机动车时，应当采取哪些安全措施？",
                "options": ["降低车速", "增大跟车距离", "开启危险报警闪光灯长时间行驶", "避免急刹车"],
                "answer": ["A", "B", "D"],
                "explanation": "雨天路面湿滑，应降低车速、增大车距并避免急刹车。危险报警闪光灯不能代替正常照明，不应在普通降雨中长时间开启。",
            },
            {
                "qtype": "judge",
                "content": "机动车在高速公路上行驶时，可以在应急车道内倒车。",
                "options": ["正确", "错误"],
                "answer": ["F"],
                "explanation": "高速公路上严禁倒车、逆行或者穿越中央分隔带掉头，应急车道也不得随意占用。",
            },
            {
                "qtype": "judge",
                "content": "驾驶机动车通过没有交通信号灯控制的人行横道时，应当减速慢行。",
                "options": ["正确", "错误"],
                "answer": ["T"],
                "explanation": "通过没有交通信号灯控制的人行横道时，机动车应当减速慢行，遇行人正在通过时应当停车让行。",
            },
            {
                "qtype": "single",
                "content": "驾驶机动车发生交通事故后，首先应当采取的措施是？",
                "options": ["立即与对方协商赔偿", "迅速离开现场", "立即停车并保护现场", "拍照后继续行驶"],
                "answer": ["C"],
                "explanation": "发生交通事故后应当立即停车，保护现场；造成人身伤亡的，还应立即抢救受伤人员并报警。",
            },
        ],
    },
    {
        "name": "科目二",
        "description": "场地驾驶技能考试相关知识",
        "sort_order": 2,
        "questions": [
            {
                "qtype": "single",
                "content": "倒车入库时，判断车身是否摆正主要应参考什么？",
                "options": ["车速表", "后视镜中车身与库边线的相对位置", "车内音响", "方向盘颜色"],
                "answer": ["B"],
                "explanation": "倒车入库应通过后视镜观察车身与库边线的平行关系，及时修正方向。",
            },
            {
                "qtype": "single",
                "content": "坡道定点停车和起步时，起步前应当做好哪项操作？",
                "options": ["直接松开制动踏板", "拉起驻车制动并挂入空挡", "踩下离合和制动，确认安全后平稳起步", "快速踩油门"],
                "answer": ["C"],
                "explanation": "坡道起步应踩住离合和制动，确认周围安全后缓慢抬离合、轻踩加速踏板，防止车辆后溜。",
            },
            {
                "qtype": "multiple",
                "content": "侧方停车的操作过程中，需要注意哪些事项？",
                "options": ["控制车速", "观察后视镜和车位线", "及时回正方向", "全程猛打方向"],
                "answer": ["A", "B", "C"],
                "explanation": "侧方停车需要低速行驶、借助后视镜观察并按照点位及时修正方向，避免车辆压线。",
            },
            {
                "qtype": "multiple",
                "content": "曲线行驶时，正确的做法包括？",
                "options": ["保持低速平稳", "根据弯道及时转动方向盘", "紧盯车头正前方", "通过后视镜辅助判断车身位置"],
                "answer": ["A", "B", "D"],
                "explanation": "曲线行驶应保持低速平稳，根据弯道走向修正方向，并借助后视镜辅助观察车身位置。",
            },
            {
                "qtype": "judge",
                "content": "倒车入库过程中，车身出线但最终停入库内，仍然属于合格。",
                "options": ["正确", "错误"],
                "answer": ["F"],
                "explanation": "倒车入库过程中车身任何部位出线均不合格，必须全程保持在规定区域内。",
            },
            {
                "qtype": "judge",
                "content": "科目二考试过程中，中途停车可能会被扣分。",
                "options": ["正确", "错误"],
                "answer": ["T"],
                "explanation": "科目二部分项目对中途停车有扣分或不合格规定，具体以考试评判标准为准。",
            },
        ],
    },
]


def _encode_options(options):
    if len(options) == 2 and options == ["正确", "错误"]:
        return json.dumps(
            [{"key": "T", "text": "正确"}, {"key": "F", "text": "错误"}],
            ensure_ascii=False,
        )
    return json.dumps(
        [{"key": chr(65 + index), "text": text} for index, text in enumerate(options)],
        ensure_ascii=False,
    )


def seed_demo_data(db):
    if db.execute("SELECT COUNT(*) AS count FROM subjects").fetchone()["count"] > 0:
        return

    for subject in DEMO_SUBJECTS:
        cursor = db.execute(
            "INSERT INTO subjects (name, description, sort_order) VALUES (?, ?, ?)",
            (subject["name"], subject["description"], subject["sort_order"]),
        )
        subject_id = cursor.lastrowid
        for question in subject["questions"]:
            db.execute(
                """
                INSERT INTO questions
                    (subject_id, qtype, content, options, answer, explanation)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    subject_id,
                    question["qtype"],
                    question["content"],
                    _encode_options(question["options"]),
                    json.dumps(question["answer"], ensure_ascii=False),
                    question["explanation"],
                ),
            )
    db.commit()


def ensure_admin(db, username, password):
    existing = db.execute(
        "SELECT id FROM users WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone()
    if existing:
        return

    db.execute(
        "INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, 'admin', 1)",
        (username, generate_password_hash(password)),
    )
    db.commit()
