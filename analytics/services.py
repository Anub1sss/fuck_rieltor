"""
Сервис глубокого анализа квартиры для покупки жилой недвижимости в Москве.
Оценка по 100-балльной шкале, 12 категорий.

Источники данных:
- Средние цены за м² (вторичка): irn.ru, январь 2026
- Криминал: прокуратура Москвы, 10 мес 2025 (преступлений на 10 тыс. жит.)
- Экология, инфраструктура, транспорт: экспертные оценки на основе открытых данных
"""
import re
from decimal import Decimal
from django.utils import timezone
from api.models import Apartment


def detect_source(url: str) -> str:
    if 'cian.ru' in url:
        return 'cian'
    if 'avito.ru' in url:
        return 'avito'
    if 'realty.yandex' in url or 'realty.ya.ru' in url:
        return 'yandex'
    return 'unknown'


# ── Справочные данные по округам Москвы ──────────────────────────────────
# avg_price_m2: средняя цена за м² на вторичном рынке, руб. (irn.ru, янв 2026)
# crime_per_10k: преступлений на 10 000 жителей (прокуратура Москвы, 10 мес 2025)

DISTRICT_DATA = {
    'Центральный': {
        'ecology': 45, 'safety': 55, 'infrastructure': 95, 'transport': 97,
        'perspective': 50, 'avg_price_m2': 441553, 'quietness': 30, 'social': 90,
        'daily': 95,
        'crime_per_10k': 147.3, 'crime_label': 'высокий (147 на 10 тыс.)',
        'noise_sources': ['дороги', 'рестораны/бары'],
        'parks': ['Парк Горького', 'Сад Эрмитаж', 'Александровский сад', 'Чистые пруды'],
        'price_trend': 'stable',
        'malls': ['ГУМ', 'ЦУМ', 'Охотный Ряд', 'Атриум', 'Метрополис'],
        'schools': ['Школа №57', 'Школа №179', 'Лицей НИУ ВШЭ', 'Школа ЦПМ'],
        'kindergartens': ['Д/с №1 Пресненского р-на', 'Д/с №2 Арбат'],
        'schools_total': 95, 'kindergartens_total': 68,
        'price_m2_2020': 340000, 'price_m2_2023': 410000,
        'clinics': ['ГКБ им. Пирогова', 'Поликлиника №1 Управделами'],
        'fitness': ['World Class Житная', 'DDX Fitness Тверская'],
    },
    'Северный': {
        'ecology': 60, 'safety': 72, 'infrastructure': 75, 'transport': 72,
        'perspective': 70, 'avg_price_m2': 297885, 'quietness': 62, 'social': 72,
        'daily': 72,
        'crime_per_10k': 70.0, 'crime_label': 'ниже среднего',
        'noise_sources': [],
        'parks': ['Парк Дружбы', 'Лианозовский парк', 'Долгие пруды'],
        'price_trend': 'rising',
        'malls': ['Гранд', 'Метрополис', 'Ривьера'],
        'schools': ['Школа №1576', 'Школа №1564', 'Гимназия №1583'],
        'kindergartens': ['Д/с №1087', 'Д/с «Росинка»'],
        'schools_total': 130, 'kindergartens_total': 155,
        'price_m2_2020': 220000, 'price_m2_2023': 275000,
        'clinics': ['ГКБ №81', 'Поликлиника №107'],
        'fitness': ['DDX Fitness Дегунино', 'Spirit. Fitness'],
    },
    'Северо-Восточный': {
        'ecology': 52, 'safety': 62, 'infrastructure': 70, 'transport': 74,
        'perspective': 65, 'avg_price_m2': 260749, 'quietness': 55, 'social': 65,
        'daily': 68,
        'crime_per_10k': 75.0, 'crime_label': 'средний',
        'noise_sources': ['промзоны'],
        'parks': ['Лосиный Остров', 'Сад будущего', 'Парк Свиблово'],
        'price_trend': 'stable',
        'malls': ['Золотой Вавилон Ростокино', 'Алтуфьевский ТЦ'],
        'schools': ['Школа №962', 'Школа №1955', 'Лицей №1568'],
        'kindergartens': ['Д/с №1495', 'Д/с №939'],
        'schools_total': 140, 'kindergartens_total': 165,
        'price_m2_2020': 195000, 'price_m2_2023': 242000,
        'clinics': ['ГКБ №40 (Коммунарка)', 'Поликлиника №218'],
        'fitness': ['Alex Fitness Свиблово', 'Spirit. Fitness ВДНХ'],
    },
    'Восточный': {
        'ecology': 50, 'safety': 60, 'infrastructure': 66, 'transport': 70,
        'perspective': 72, 'avg_price_m2': 256698, 'quietness': 55, 'social': 62,
        'daily': 66,
        'crime_per_10k': 72.0, 'crime_label': 'средний',
        'noise_sources': ['Щёлковское шоссе'],
        'parks': ['Измайловский парк', 'Сокольники', 'Терлецкий лесопарк'],
        'price_trend': 'rising',
        'malls': ['Щёлково', 'Город', 'Перово Молл'],
        'schools': ['Школа №444', 'Школа №1811', 'Гимназия №1530'],
        'kindergartens': ['Д/с №2355', 'Д/с «Радуга»'],
        'schools_total': 150, 'kindergartens_total': 175,
        'price_m2_2020': 185000, 'price_m2_2023': 235000,
        'clinics': ['ГКБ №15 им. Филатова', 'Поликлиника №69'],
        'fitness': ['DDX Fitness Перово', 'Фитнес-хаус Измайлово'],
    },
    'Юго-Восточный': {
        'ecology': 35, 'safety': 48, 'infrastructure': 58, 'transport': 65,
        'perspective': 68, 'avg_price_m2': 245952, 'quietness': 42, 'social': 55,
        'daily': 60,
        'crime_per_10k': 80.0, 'crime_label': 'выше среднего',
        'noise_sources': ['промзоны', 'МКАД', 'ж/д'],
        'parks': ['Кузьминки', 'Люблинский парк'],
        'price_trend': 'rising',
        'malls': ['Мариэль', 'Люблино', 'Братеево ТЦ'],
        'schools': ['Школа №1357', 'Школа №1524'],
        'kindergartens': ['Д/с №2336', 'Д/с «Лучик»'],
        'schools_total': 105, 'kindergartens_total': 120,
        'price_m2_2020': 170000, 'price_m2_2023': 225000,
        'clinics': ['ГКБ им. Буянова', 'Поликлиника №109'],
        'fitness': ['Alex Fitness Люблино', 'Gym Lime Марьино'],
    },
    'Южный': {
        'ecology': 48, 'safety': 75, 'infrastructure': 72, 'transport': 76,
        'perspective': 65, 'avg_price_m2': 262980, 'quietness': 50, 'social': 70,
        'daily': 72,
        'crime_per_10k': 56.5, 'crime_label': 'самый низкий в Москве',
        'noise_sources': ['Варшавское шоссе'],
        'parks': ['Царицыно', 'Коломенское', 'Бирюлёвский дендропарк'],
        'price_trend': 'stable',
        'malls': ['Галерея Аэропорт', 'Колумбус', 'Домодедовский ТЦ'],
        'schools': ['Школа №870', 'Школа №1158', 'Лицей №507'],
        'kindergartens': ['Д/с №2687', 'Д/с «Солнышко»'],
        'schools_total': 165, 'kindergartens_total': 195,
        'price_m2_2020': 195000, 'price_m2_2023': 245000,
        'clinics': ['ГКБ №12', 'Поликлиника №166'],
        'fitness': ['DDX Fitness Орехово', 'World Gym Чертаново'],
    },
    'Юго-Западный': {
        'ecology': 75, 'safety': 72, 'infrastructure': 82, 'transport': 80,
        'perspective': 68, 'avg_price_m2': 323916, 'quietness': 70, 'social': 82,
        'daily': 82,
        'crime_per_10k': 68.0, 'crime_label': 'ниже среднего',
        'noise_sources': [],
        'parks': ['Воронцовский парк', 'Битцевский лес', 'Тропарёво'],
        'price_trend': 'stable',
        'malls': ['Галерея Калужская', 'Принц Плаза', 'Тропарёво ТЦ'],
        'schools': ['Школа №1329 (при МГУ)', 'Школа №109', 'Лицей «Вторая школа»'],
        'kindergartens': ['Д/с №1338', 'Д/с «Академия малышей»'],
        'schools_total': 115, 'kindergartens_total': 130,
        'price_m2_2020': 250000, 'price_m2_2023': 305000,
        'clinics': ['ГКБ №64', 'Поликлиника №11'],
        'fitness': ['World Class Юго-Запад', 'DDX Fitness Тёплый Стан'],
    },
    'Западный': {
        'ecology': 70, 'safety': 70, 'infrastructure': 80, 'transport': 80,
        'perspective': 75, 'avg_price_m2': 328292, 'quietness': 65, 'social': 78,
        'daily': 80,
        'crime_per_10k': 72.0, 'crime_label': 'средний',
        'noise_sources': [],
        'parks': ['Парк Победы', 'Филёвский парк', 'Серебряный бор'],
        'price_trend': 'rising',
        'malls': ['Европейский', 'Кунцево Плаза', 'Филион'],
        'schools': ['Школа №1329', 'Школа №1514', 'Курчатовская школа'],
        'kindergartens': ['Д/с №2337', 'Д/с «Берёзка»'],
        'schools_total': 120, 'kindergartens_total': 140,
        'price_m2_2020': 250000, 'price_m2_2023': 310000,
        'clinics': ['ГКБ №31', 'Поликлиника №209'],
        'fitness': ['World Class Кунцево', 'DDX Fitness Крылатское'],
    },
    'Северо-Западный': {
        'ecology': 75, 'safety': 68, 'infrastructure': 72, 'transport': 68,
        'perspective': 82, 'avg_price_m2': 294054, 'quietness': 72, 'social': 72,
        'daily': 72,
        'crime_per_10k': 84.0, 'crime_label': 'выше среднего',
        'noise_sources': [],
        'parks': ['Покровское-Стрешнево', 'Серебряный бор', 'Парк Северное Тушино'],
        'price_trend': 'rising',
        'malls': ['Калейдоскоп', 'Митино Парк ТЦ', 'Ашан Красногорск'],
        'schools': ['Школа №1571', 'Школа №1302', 'Гимназия №1519'],
        'kindergartens': ['Д/с №1685', 'Д/с «Умка»'],
        'schools_total': 95, 'kindergartens_total': 110,
        'price_m2_2020': 210000, 'price_m2_2023': 270000,
        'clinics': ['ГКБ №52', 'Поликлиника №180'],
        'fitness': ['Spirit. Fitness Тушино', 'DDX Fitness Митино'],
    },
    'Новомосковский': {
        'ecology': 78, 'safety': 60, 'infrastructure': 50, 'transport': 45,
        'perspective': 88, 'avg_price_m2': 214761, 'quietness': 78, 'social': 48,
        'daily': 48,
        'crime_per_10k': 84.4, 'crime_label': 'выше среднего (рост +3.9%)',
        'noise_sources': [],
        'parks': ['Парк Филатов луг', 'Ульяновский лесопарк'],
        'price_trend': 'rising',
        'malls': ['Саларис', 'Новомосковский ТЦ'],
        'schools': ['Школа №2065', 'Школа №2070'],
        'kindergartens': ['Д/с «Сказка» Коммунарка'],
        'schools_total': 45, 'kindergartens_total': 40,
        'price_m2_2020': 130000, 'price_m2_2023': 185000,
        'clinics': ['Поликлиника Коммунарки'],
        'fitness': ['DDX Fitness Коммунарка'],
    },
    'Троицкий': {
        'ecology': 88, 'safety': 62, 'infrastructure': 35, 'transport': 30,
        'perspective': 72, 'avg_price_m2': 180405, 'quietness': 88, 'social': 35,
        'daily': 35,
        'crime_per_10k': 84.4, 'crime_label': 'выше среднего (рост +3.9%)',
        'noise_sources': [],
        'parks': [],
        'price_trend': 'stable',
        'malls': [],
        'schools': ['Школа №2083 Троицк'],
        'kindergartens': ['Д/с «Ромашка» Троицк'],
        'schools_total': 18, 'kindergartens_total': 15,
        'price_m2_2020': 115000, 'price_m2_2023': 155000,
        'clinics': ['Поликлиника Троицка'],
        'fitness': [],
    },
}

BUILDING_SERIES_DATA = {
    'П-44': {'sound': 55, 'layout': 65, 'ceiling': 2.7, 'walls': 'панель', 'quality': 60},
    'П-44Т': {'sound': 60, 'layout': 70, 'ceiling': 2.7, 'walls': 'панель', 'quality': 68},
    'КОПЭ': {'sound': 50, 'layout': 60, 'ceiling': 2.64, 'walls': 'панель', 'quality': 55},
    'П-3': {'sound': 45, 'layout': 55, 'ceiling': 2.64, 'walls': 'панель', 'quality': 50},
    'И-155': {'sound': 65, 'layout': 70, 'ceiling': 2.74, 'walls': 'панель', 'quality': 70},
    'И-522А': {'sound': 40, 'layout': 45, 'ceiling': 2.48, 'walls': 'блок', 'quality': 35},
    'I-515': {'sound': 30, 'layout': 35, 'ceiling': 2.48, 'walls': 'панель (хрущёвка)', 'quality': 25},
    'монолит': {'sound': 70, 'layout': 80, 'ceiling': 2.8, 'walls': 'монолит', 'quality': 78},
    'кирпич': {'sound': 80, 'layout': 75, 'ceiling': 2.7, 'walls': 'кирпич', 'quality': 75},
}

DISTRICT_PERSPECTIVES = {
    'Центральный': 'Стабильный спрос, максимальные цены. Новое строительство ограничено — реставрация и реконструкция. Лучшая транспортная связь в городе.',
    'Северный': 'Активное развитие транспорта — новые станции метро на Люблинско-Дмитровской линии. Программа реновации. Цены растут.',
    'Северо-Восточный': 'Умеренное развитие. Реновация старого фонда, постепенное обновление инфраструктуры.',
    'Восточный': 'Перспективный: новые станции МЦД, редевелопмент промзон под жильё. Цены ниже средних, но растут.',
    'Юго-Восточный': 'Экология ниже среднего (промзоны Капотни, Люблино). Активная реновация. Хорошие новостройки вдоль метро.',
    'Южный': 'Самый безопасный округ Москвы (56.5 преступлений на 10 тыс. жителей). Хорошая транспортная доступность, умеренные цены.',
    'Юго-Западный': 'Престижный район: экология (Битцевский лес, Тропарёво), МГУ. Стабильные высокие цены.',
    'Западный': 'Развитая инфраструктура, хорошая экология. Москва-Сити рядом. Вторая по стоимости после ЦАО.',
    'Северо-Западный': 'Перспективный: новые ЖК, экология (Серебряный бор). Транспорт пока средний. Цены растут.',
    'Новомосковский': 'Максимальный потенциал роста цен. Массовое строительство, новые станции метро. Инфраструктура пока догоняет.',
    'Троицкий': 'Загородный характер, отличная экология. Транспорт слабый. Самые низкие цены в Москве.',
}

_DATA_SOURCES_NOTE = 'Цены: irn.ru, янв 2026. Криминал: прокуратура Москвы, 10 мес 2025.'


# ── Скоринг по категориям ───────────────────────────────────────────────

def _score_floor(floor, total_floors):
    if not floor or not total_floors:
        return 50
    if floor == 1:
        return 25
    if floor == total_floors:
        return 35
    ratio = floor / total_floors
    if 0.15 <= ratio <= 0.65:
        return 85
    if ratio > 0.65:
        return 60 + int((1 - ratio) * 80)
    return 50


def _score_building(year, rc_class, building_type, series, features_count):
    score = 45
    if year:
        age = timezone.now().year - year
        if age <= 2:
            score += 30
        elif age <= 7:
            score += 25
        elif age <= 15:
            score += 15
        elif age <= 30:
            score += 5
        elif age > 50:
            score -= 15

    class_map = {'элит': 25, 'премиум': 22, 'бизнес': 18, 'комфорт': 12, 'эконом': 3}
    for key, bonus in class_map.items():
        if key in (rc_class or '').lower():
            score += bonus
            break

    type_map = {'монолитно-кирпичный': 14, 'монолит': 15, 'кирпич': 12, 'панель': 3, 'блок': 2}
    for key, bonus in type_map.items():
        if key in (building_type or '').lower():
            score += bonus
            break

    score += min(features_count * 2, 10)
    return max(0, min(100, score))


def _score_apartment_layout(area, living_area, kitchen_area, ceiling_height, rooms, bathroom_type, has_balcony, has_loggia):
    score = 50
    if area:
        a = float(area)
        if a > 80:
            score += 15
        elif a > 55:
            score += 10
        elif a < 30:
            score -= 10
    if kitchen_area:
        k = float(kitchen_area)
        if k >= 12:
            score += 12
        elif k >= 9:
            score += 8
        elif k < 6:
            score -= 10
    if ceiling_height:
        h = float(ceiling_height)
        if h >= 3.0:
            score += 10
        elif h >= 2.7:
            score += 5
        elif h < 2.5:
            score -= 8
    if 'раздельный' in (bathroom_type or '').lower():
        score += 5
    if has_balcony:
        score += 4
    if has_loggia:
        score += 5
    return max(0, min(100, score))


def _score_price_quality(price_per_m2, district_avg_m2):
    """Сравниваем цену за м² квартиры со средней по округу."""
    if not price_per_m2 or not district_avg_m2:
        return 50
    ratio = float(price_per_m2) / float(district_avg_m2)
    if ratio < 0.7:
        return 95
    if ratio < 0.85:
        return 82
    if ratio < 0.95:
        return 70
    if ratio < 1.05:
        return 58
    if ratio < 1.15:
        return 45
    if ratio < 1.3:
        return 35
    return 20


def _score_safety_from_crime(crime_per_10k):
    """Оценка безопасности на основе реальной статистики преступлений."""
    if not crime_per_10k:
        return 60
    if crime_per_10k <= 57:
        return 85
    if crime_per_10k <= 70:
        return 75
    if crime_per_10k <= 80:
        return 65
    if crime_per_10k <= 90:
        return 55
    if crime_per_10k <= 110:
        return 45
    return 30


def _score_quietness(floor, near_highway, near_railway, near_industrial, near_airport, noise_sources_count):
    score = 75
    if floor and floor <= 3:
        score -= 10
    if near_highway:
        score -= 20
    if near_railway:
        score -= 18
    if near_industrial:
        score -= 12
    if near_airport:
        score -= 25
    score -= noise_sources_count * 5
    return max(0, min(100, score))


def _score_social_infra(dd_social):
    """Используем экспертную оценку по округу, а не фейковые объекты."""
    return dd_social


def _score_daily_comfort(dd_daily):
    return dd_daily


def _estimate_commute(metro_distance_min):
    """
    Грубая оценка времени в пути: пешком до метро + среднее время в метро до центра.
    Без рандома — детерминированная формула.
    """
    walk = metro_distance_min or 15
    avg_metro_ride = 25
    return min(walk + avg_metro_ride, 90)


# ── Генерация плюсов / минусов / предупреждений ────────────────────────

def _generate_advantages(a):
    pros = []
    if a.score_transport >= 70:
        pros.append('Отличная транспортная доступность')
    if a.score_ecology >= 70:
        pros.append('Хорошая экология района')
    if a.score_infrastructure >= 70:
        pros.append('Развитая инфраструктура')
    if a.score_safety >= 75:
        pros.append('Безопасный район')
    if a.score_price_quality >= 70:
        pros.append('Цена ниже средней по округу — хорошее соотношение')
    if a.score_building >= 70:
        pros.append('Качественный дом / ЖК')
    if a.score_floor >= 70:
        pros.append('Удачный этаж')
    if a.score_apartment_layout >= 70:
        pros.append('Хорошая планировка')
    if a.score_district_perspective >= 75:
        pros.append('Перспективный район для инвестиций')
    if a.score_quietness >= 70:
        pros.append('Тихое место')
    if a.rc_closed_territory:
        pros.append('Закрытая территория')
    if a.rc_underground_parking:
        pros.append('Подземный паркинг')
    if a.rc_concierge:
        pros.append('Консьерж')
    if a.metro_distance_min and a.metro_distance_min <= 7:
        pros.append(f'Метро в {a.metro_distance_min} мин пешком')
    if a.has_mcd:
        pros.append('Рядом станция МЦД')
    if a.kitchen_area and float(a.kitchen_area) >= 12:
        pros.append(f'Большая кухня ({a.kitchen_area} м²)')
    if a.ceiling_height and float(a.ceiling_height) >= 3.0:
        pros.append(f'Высокие потолки ({a.ceiling_height} м)')
    if a.has_loggia:
        pros.append('Лоджия')
    if a.has_balcony and not a.has_loggia:
        pros.append('Балкон')
    return pros


def _generate_disadvantages(a):
    cons = []
    if a.score_transport < 50:
        cons.append('Слабая транспортная доступность')
    if a.score_ecology < 45:
        cons.append('Неблагоприятная экология')
    if a.score_infrastructure < 45:
        cons.append('Недостаточно развитая инфраструктура')
    if a.score_safety < 50:
        cons.append('Повышенный уровень преступности в округе')
    if a.score_price_quality < 40:
        cons.append('Цена за м² выше средней по округу')
    if a.score_quietness < 40:
        cons.append('Шумное расположение')
    if a.floor == 1:
        cons.append('Первый этаж — шум, пыль, безопасность')
    if a.total_floors and a.floor == a.total_floors:
        cons.append('Последний этаж — возможны протечки кровли')
    if a.metro_distance_min and a.metro_distance_min > 20:
        cons.append(f'Далеко от метро ({a.metro_distance_min} мин)')
    if a.near_highway:
        cons.append('Рядом загруженная магистраль (шум, выбросы)')
    if a.near_railway:
        cons.append('Рядом железная дорога (шум, вибрация)')
    if a.near_industrial_zone:
        cons.append('Рядом промзона')
    if a.near_airport_noise:
        cons.append('Зона шума от аэропорта')
    if a.commute_husband_min and a.commute_husband_min > 60:
        cons.append(f'Долгая дорога на работу мужа (~{a.commute_husband_min} мин)')
    if a.commute_wife_min and a.commute_wife_min > 60:
        cons.append(f'Долгая дорога на работу жены (~{a.commute_wife_min} мин)')
    if a.commute_school_min and a.commute_school_min > 30:
        cons.append(f'Далеко от школы (~{a.commute_school_min} мин)')
    if a.rc_year_built and (timezone.now().year - a.rc_year_built) > 45:
        cons.append('Старый жилой фонд (>45 лет)')
    if a.kitchen_area and float(a.kitchen_area) < 6:
        cons.append('Очень маленькая кухня (<6 м²)')
    if a.ceiling_height and float(a.ceiling_height) < 2.5:
        cons.append('Низкие потолки (<2.5 м)')
    return cons


def _generate_warnings(a):
    warns = []
    if a.floor == 1:
        warns.append('Проверьте подвал на сырость и грызунов')
    if a.total_floors and a.floor == a.total_floors:
        warns.append('Осмотрите потолок на следы протечек')
    if a.rc_year_built and (timezone.now().year - a.rc_year_built) > 30:
        warns.append('Проверьте состояние электропроводки (медь или алюминий) и труб')
    if a.has_garbage_chute:
        warns.append('Мусоропровод — проверьте запахи на этаже')
    if 'свободная' in (a.renovation_type or '').lower() or 'без' in (a.renovation_type or '').lower():
        warns.append('Потребуется ремонт — заложите бюджет от 15 000 ₽/м²')
    warns.append('Посетите квартиру вечером пятницы и утром субботы — оцените шум соседей')
    warns.append('Проверьте мобильную связь и интернет-провайдеров прямо в квартире')
    warns.append('Запросите у собственника платёжку ЖКУ за последний месяц')
    warns.append('Проверьте давление воды — откройте кран на кухне и в душе одновременно')
    return warns


def _generate_recommendation(a):
    score = a.score_total
    if score >= 80:
        verdict = "Отличный вариант"
    elif score >= 65:
        verdict = "Хороший вариант"
    elif score >= 50:
        verdict = "Средний вариант, есть компромиссы"
    elif score >= 35:
        verdict = "Ниже среднего — существенные минусы"
    else:
        verdict = "Не рекомендуется"

    parts = [f"{verdict} ({score}/100)."]
    if a.advantages:
        parts.append(f"Главные плюсы: {', '.join(a.advantages[:3]).lower()}.")
    if a.disadvantages:
        parts.append(f"Обратите внимание: {', '.join(a.disadvantages[:3]).lower()}.")
    return ' '.join(parts)


# ── Подробные пояснения ────────────────────────────────────────────────

def _fmt(n):
    """Форматирование числа с пробелами-разделителями."""
    return f'{int(n):,}'.replace(',', ' ')


def _generate_explanations(a, dd, district_key, profile):
    ex = {}

    # Этаж
    if a.floor and a.total_floors:
        ratio = a.floor / a.total_floors
        if a.floor == 1:
            ex['floor'] = f'1-й этаж из {a.total_floors} — минусы: шум с улицы, пыль, ниже безопасность. Плюсы: не зависит от лифта.'
        elif a.floor == a.total_floors:
            ex['floor'] = f'Последний ({a.floor}-й) этаж из {a.total_floors} — риск протечек кровли, жарко летом. Плюс: нет соседей сверху.'
        elif 0.15 <= ratio <= 0.65:
            ex['floor'] = f'{a.floor}-й этаж из {a.total_floors} — оптимальный диапазон (15-65% высоты дома). Нет шума с улицы, нет проблем верхних этажей.'
        else:
            ex['floor'] = f'{a.floor}-й этаж из {a.total_floors}.'

    # Транспорт
    parts = []
    if a.metro_station:
        parts.append(f'Ближайшее метро: {a.metro_station}')
        if a.metro_distance_min:
            parts.append(f'{a.metro_distance_min} мин пешком')
    noise_src = dd.get('noise_sources', [])
    if noise_src:
        parts.append(f'Источники шума в округе: {", ".join(noise_src)}')
    if a.has_mcd:
        parts.append('Есть станция МЦД — альтернатива метро')
    if district_key:
        parts.append(f'Округ: {district_key}')
    ex['transport'] = '. '.join(parts) + '.' if parts else ''

    # Экология
    parks = dd.get('parks', [])
    eco_parts = [f'Экология {district_key or "округа"}: {a.score_ecology}/100']
    if parks:
        eco_parts.append(f'Парки рядом: {", ".join(parks[:3])}')
    if a.near_industrial_zone:
        eco_parts.append('В округе есть промзоны — проверьте розу ветров')
    if a.near_highway:
        hw = [s for s in noise_src if 'шоссе' in s.lower() or 'мкад' in s.lower() or 'дороги' in s.lower()]
        eco_parts.append(f'Рядом магистрали: {", ".join(hw) if hw else "загруженные дороги"}')
    ex['ecology'] = '. '.join(eco_parts) + '.'

    # Безопасность
    crime_10k = dd.get('crime_per_10k')
    crime_label = dd.get('crime_label', '')
    if crime_10k:
        safe_parts = [f'{district_key or "Округ"}: {crime_10k} преступлений на 10 тыс. жителей ({crime_label})']
        safe_parts.append('Для сравнения: самый безопасный — ЮАО (56.5), самый криминальный — ЦАО (147.3)')
        safe_parts.append('Данные: прокуратура Москвы, 10 мес 2025')
        ex['safety'] = '. '.join(safe_parts) + '.'
    else:
        ex['safety'] = 'Нет данных по округу.'

    # Цена/качество + динамика цен
    price_parts = []
    if a.price_per_m2 and a.district_avg_price:
        ppm = float(a.price_per_m2)
        avg = float(a.district_avg_price)
        pct = round(ppm / avg * 100)
        if ppm < avg:
            price_parts.append(f'Цена за м² ({_fmt(ppm)} ₽) ниже средней по {district_key or "округу"} ({_fmt(avg)} ₽/м²) — это {pct}% от средней. Выгодное предложение')
        else:
            price_parts.append(f'Цена за м² ({_fmt(ppm)} ₽) выше средней по {district_key or "округу"} ({_fmt(avg)} ₽/м²) — это {pct}% от средней')
    p2020 = dd.get('price_m2_2020')
    p2023 = dd.get('price_m2_2023')
    p_now = dd.get('avg_price_m2')
    if p2020 and p_now:
        growth_total = round((p_now - p2020) / p2020 * 100)
        price_parts.append(f'Динамика цен в округе: 2020 → {_fmt(p2020)} ₽/м², 2023 → {_fmt(p2023)} ₽/м², 2026 → {_fmt(p_now)} ₽/м² (рост +{growth_total}% за 6 лет)')
        if p2023:
            growth_3y = round((p_now - p2023) / p2023 * 100)
            price_parts.append(f'За последние 3 года: +{growth_3y}%')
    price_parts.append('Данные: irn.ru, янв 2026')
    ex['price'] = '. '.join(price_parts) + '.'

    # Дом
    bld = []
    if a.building_type:
        bld.append(f'Тип: {a.building_type}')
    if a.rc_year_built:
        age = timezone.now().year - a.rc_year_built
        bld.append(f'Год постройки: {a.rc_year_built} (возраст {age} лет)')
        if age <= 5:
            bld.append('Новый дом — современные коммуникации и планировки')
        elif age > 40:
            bld.append('Старый фонд — возможны проблемы с проводкой (алюминий), трубами, звукоизоляцией')
    if a.rc_class:
        bld.append(f'Класс ЖК: {a.rc_class}')
    if a.building_series:
        sd = BUILDING_SERIES_DATA.get(a.building_series)
        if sd:
            bld.append(f'Серия {a.building_series}: стены — {sd["walls"]}, потолки ~{sd["ceiling"]} м, звукоизоляция {sd["sound"]}/100')
    ex['building'] = '. '.join(bld) + '.' if bld else ''

    # Планировка
    lay = []
    if a.area:
        lay.append(f'Общая {a.area} м²')
    if a.kitchen_area:
        k = float(a.kitchen_area)
        if k >= 12:
            lay.append(f'кухня {a.kitchen_area} м² — просторная, можно разместить обеденную зону')
        elif k >= 9:
            lay.append(f'кухня {a.kitchen_area} м² — стандартная')
        elif k < 6:
            lay.append(f'кухня {a.kitchen_area} м² — очень мала, только готовка')
        else:
            lay.append(f'кухня {a.kitchen_area} м²')
    if a.ceiling_height:
        h = float(a.ceiling_height)
        if h >= 3.0:
            lay.append(f'потолки {a.ceiling_height} м — высокие, ощущение простора')
        elif h < 2.5:
            lay.append(f'потолки {a.ceiling_height} м — низковато, давит')
        else:
            lay.append(f'потолки {a.ceiling_height} м')
    if a.bathroom_type:
        lay.append(f'санузел: {a.bathroom_type}')
    ex['layout'] = ', '.join(lay) + '.' if lay else ''

    # Тишина
    quiet_parts = []
    if noise_src:
        quiet_parts.append(f'В {district_key or "округе"} источники шума: {", ".join(noise_src)}')
    if a.floor and a.floor <= 3:
        quiet_parts.append('Низкий этаж — больше шума с улицы')
    if not noise_src and (not a.floor or a.floor > 3):
        quiet_parts.append('Нет явных источников шума в округе')
    ex['quietness'] = '. '.join(quiet_parts) + '.' if quiet_parts else 'Нет данных.'

    # Район/перспективы
    ex['perspective'] = DISTRICT_PERSPECTIVES.get(district_key, 'Информация обновляется.')

    # ТЦ рядом
    malls = dd.get('malls', [])
    if malls:
        ex['malls'] = f'Крупные ТЦ в округе: {", ".join(malls[:4])}.'
    else:
        ex['malls'] = 'Крупных ТЦ в округе нет — ближайшие за пределами.'

    # Школы
    schools = dd.get('schools', [])
    schools_total = dd.get('schools_total', 0)
    school_parts = []
    if schools:
        school_parts.append(f'Известные школы: {", ".join(schools[:3])}')
    if schools_total:
        school_parts.append(f'Всего школ в округе: ~{schools_total}')
    school_parts.append('Данные: mos.ru, реестр образовательных организаций')
    ex['schools'] = '. '.join(school_parts) + '.'

    # Детские сады
    kinders = dd.get('kindergartens', [])
    kinders_total = dd.get('kindergartens_total', 0)
    kinder_parts = []
    if kinders:
        kinder_parts.append(f'Детские сады: {", ".join(kinders[:3])}')
    if kinders_total:
        kinder_parts.append(f'Всего в округе: ~{kinders_total}')
    kinder_parts.append('Данные: mos.ru')
    ex['kindergartens'] = '. '.join(kinder_parts) + '.'

    # Клиники / поликлиники
    clinics = dd.get('clinics', [])
    if clinics:
        ex['clinics'] = f'Медицина: {", ".join(clinics[:3])}.'
    else:
        ex['clinics'] = 'Данных о крупных клиниках нет.'

    # Фитнес
    fitness = dd.get('fitness', [])
    if fitness:
        ex['fitness'] = f'Фитнес-клубы: {", ".join(fitness[:3])}.'

    # Кто покупает
    bt = profile.buyer_type
    if bt == 'single':
        ex['buyer'] = 'Покупает один человек. Приоритет: транспорт, инфраструктура, цена.'
    elif bt == 'couple':
        ex['buyer'] = 'Покупает пара. Приоритет: транспорт до обоих мест работы, район, цена/качество.'
    else:
        ex['buyer'] = 'Покупает семья с детьми. Приоритет: школы/сады рядом, безопасность, экология, площадки.'
        if not a.rc_playground and not a.rc_closed_territory:
            ex['buyer'] += ' Внимание: нет данных о детской площадке и закрытой территории.'
        if schools:
            ex['buyer'] += f' Рейтинговые школы рядом: {", ".join(schools[:2])}.'
        if kinders:
            ex['buyer'] += f' Детские сады: {", ".join(kinders[:2])}.'

    return ex


# ── Поиск похожих ──────────────────────────────────────────────────────

def _apt_to_dict(apt, group):
    return {
        'id': apt.id,
        'title': apt.title or f"{apt.rooms}-комн., {apt.area} м²",
        'price': str(apt.price), 'area': str(apt.area) if apt.area else None,
        'rooms': apt.rooms, 'address': apt.address or '',
        'metro_station': apt.metro_station or '', 'url': apt.url, 'source': apt.source,
        'group': group,
    }


def _find_similar(analysis):
    seen_ids = set()
    results = []

    # 1) В том же ЖК / доме — ищем по совпадению адреса (без квартиры)
    rc_name = analysis.residential_complex or ''
    address = analysis.address or ''
    if rc_name or address:
        qs = Apartment.objects.filter(is_active=True)
        if rc_name:
            qs = qs.filter(
                models.Q(address__icontains=rc_name) |
                models.Q(title__icontains=rc_name)
            )
        elif address:
            addr_parts = [p.strip() for p in address.replace(',', ' ').split() if len(p.strip()) > 3]
            q = models.Q()
            for part in addr_parts[:3]:
                q &= models.Q(address__icontains=part)
            if q:
                qs = qs.filter(q)
        for apt in qs.order_by('-created_at')[:8]:
            if apt.id not in seen_ids:
                seen_ids.add(apt.id)
                results.append(_apt_to_dict(apt, 'same_building'))

    # 2) У той же станции метро
    metro = analysis.metro_station or ''
    if metro:
        qs = Apartment.objects.filter(is_active=True, metro_station__icontains=metro)
        if analysis.rooms is not None:
            qs = qs.filter(rooms__in=[max(0, analysis.rooms - 1), analysis.rooms, analysis.rooms + 1])
        for apt in qs.order_by('-created_at')[:10]:
            if apt.id not in seen_ids:
                seen_ids.add(apt.id)
                results.append(_apt_to_dict(apt, 'same_metro'))

    # 3) Похожие по параметрам (цена ±30%, те же комнаты)
    qs = Apartment.objects.filter(is_active=True)
    if analysis.rooms is not None:
        qs = qs.filter(rooms=analysis.rooms)
    if analysis.price:
        lo, hi = float(analysis.price) * 0.7, float(analysis.price) * 1.3
        qs = qs.filter(price__gte=lo, price__lte=hi)
    for apt in qs.order_by('-created_at')[:10]:
        if apt.id not in seen_ids:
            seen_ids.add(apt.id)
            results.append(_apt_to_dict(apt, 'similar'))

    return results


# ── Главная функция анализа ────────────────────────────────────────────

def analyze_apartment(analysis):
    analysis.status = 'analyzing'
    analysis.save(update_fields=['status'])

    try:
        profile = analysis.family_profile

        # Определяем округ
        dd = None
        district_key = None
        for name in DISTRICT_DATA:
            if name.lower() in (analysis.district or '').lower():
                district_key = name
                dd = DISTRICT_DATA[name]
                break
        if not dd:
            dd = {
                'ecology': 55, 'safety': 60, 'infrastructure': 65, 'transport': 65,
                'perspective': 60, 'avg_price_m2': 270000, 'quietness': 60, 'social': 60,
                'daily': 60, 'crime_per_10k': 75, 'crime_label': 'нет данных',
                'noise_sources': [], 'parks': [], 'price_trend': 'stable',
            }

        avg_price_m2 = dd['avg_price_m2']

        # Цена за м²
        if analysis.price and analysis.area and float(analysis.area) > 0:
            analysis.price_per_m2 = Decimal(str(round(float(analysis.price) / float(analysis.area))))

        # ── Скоринг (детерминированный — без рандома) ──
        analysis.score_ecology = dd['ecology']
        analysis.score_safety = _score_safety_from_crime(dd.get('crime_per_10k'))
        analysis.score_infrastructure = dd['infrastructure']
        analysis.score_transport = dd['transport']

        if analysis.metro_distance_min:
            if analysis.metro_distance_min <= 5:
                analysis.score_transport = min(100, analysis.score_transport + 8)
            elif analysis.metro_distance_min <= 10:
                analysis.score_transport = min(100, analysis.score_transport + 3)
            elif analysis.metro_distance_min > 20:
                analysis.score_transport = max(0, analysis.score_transport - 10)

        if analysis.has_mcd:
            analysis.score_transport = min(100, analysis.score_transport + 5)

        analysis.score_district_perspective = dd['perspective']
        analysis.score_quietness = _score_quietness(
            analysis.floor, analysis.near_highway, analysis.near_railway,
            analysis.near_industrial_zone, analysis.near_airport_noise,
            len(dd.get('noise_sources', [])),
        )
        analysis.score_floor = _score_floor(analysis.floor, analysis.total_floors)
        analysis.score_building = _score_building(
            analysis.rc_year_built, analysis.rc_class, analysis.building_type,
            analysis.building_series, len(analysis.rc_features or []),
        )
        analysis.score_apartment_layout = _score_apartment_layout(
            analysis.area, analysis.living_area, analysis.kitchen_area,
            analysis.ceiling_height, analysis.rooms, analysis.bathroom_type,
            analysis.has_balcony, analysis.has_loggia,
        )
        analysis.score_price_quality = _score_price_quality(
            analysis.price_per_m2, avg_price_m2,
        )
        analysis.score_social_infra = _score_social_infra(dd['social'])
        analysis.score_daily_comfort = _score_daily_comfort(dd['daily'])

        # Инфраструктура — реальные данные по округу
        analysis.nearby_parks = dd.get('parks', [])[:4]
        analysis.nearby_schools = dd.get('schools', [])[:4]
        analysis.nearby_kindergartens = dd.get('kindergartens', [])[:3]
        analysis.nearby_malls = dd.get('malls', [])[:4]
        analysis.nearby_clinics = dd.get('clinics', [])[:3]
        analysis.nearby_fitness = dd.get('fitness', [])[:3]
        analysis.schools_total_in_district = dd.get('schools_total')
        analysis.kindergartens_total_in_district = dd.get('kindergartens_total')

        # Район — реальные данные
        analysis.district_avg_price = Decimal(str(avg_price_m2))
        analysis.district_crime_level = dd.get('crime_label', '')
        analysis.district_price_trend = dd.get('price_trend', 'stable')
        analysis.district_perspective = DISTRICT_PERSPECTIVES.get(district_key, 'Информация обновляется.')

        # Окружение (из справочника округа)
        noise_src = dd.get('noise_sources', [])
        analysis.near_highway = any(x in str(noise_src) for x in ['шоссе', 'МКАД', 'дороги'])
        analysis.near_railway = 'ж/д' in str(noise_src)
        analysis.near_industrial_zone = 'промзоны' in str(noise_src)

        if analysis.near_highway or analysis.near_railway:
            analysis.noise_level = 'повышенный'
        elif analysis.near_industrial_zone:
            analysis.noise_level = 'умеренно повышенный'
        else:
            analysis.noise_level = 'нормальный'

        # Время в дороге (детерминированное)
        if profile.husband_work_address:
            analysis.commute_husband_min = _estimate_commute(analysis.metro_distance_min)
        if profile.wife_work_address:
            analysis.commute_wife_min = _estimate_commute(analysis.metro_distance_min)
        if profile.has_children and profile.children_school_address:
            analysis.commute_school_min = max(8, _estimate_commute(analysis.metro_distance_min) - 10)
        if profile.has_children and profile.children_kindergarten_address:
            analysis.commute_kindergarten_min = max(5, _estimate_commute(analysis.metro_distance_min) - 15)

        # Clamp all scores
        score_fields = [
            'score_ecology', 'score_safety', 'score_infrastructure', 'score_transport',
            'score_district_perspective', 'score_quietness', 'score_floor', 'score_building',
            'score_apartment_layout', 'score_price_quality', 'score_social_infra', 'score_daily_comfort',
        ]
        for f in score_fields:
            setattr(analysis, f, max(0, min(100, getattr(analysis, f))))

        # Итоговый балл (взвешенный)
        weights = {
            'score_transport': 0.15, 'score_ecology': 0.08, 'score_infrastructure': 0.08,
            'score_safety': 0.08, 'score_price_quality': 0.18, 'score_building': 0.10,
            'score_floor': 0.06, 'score_apartment_layout': 0.10,
            'score_district_perspective': 0.05, 'score_quietness': 0.05,
            'score_social_infra': 0.04, 'score_daily_comfort': 0.03,
        }
        total = sum(getattr(analysis, k) * w for k, w in weights.items())
        analysis.score_total = max(0, min(100, round(total)))

        analysis.explanations = _generate_explanations(analysis, dd, district_key, profile)
        analysis.advantages = _generate_advantages(analysis)
        analysis.disadvantages = _generate_disadvantages(analysis)
        analysis.warnings = _generate_warnings(analysis)
        analysis.recommendation = _generate_recommendation(analysis)
        analysis.similar_apartments = _find_similar(analysis)

        analysis.status = 'done'
        analysis.analyzed_at = timezone.now()
        analysis.save()

    except Exception as e:
        analysis.status = 'error'
        analysis.error_message = str(e)
        analysis.save(update_fields=['status', 'error_message'])
        raise


# ── Заполнение из существующей записи или заглушка ─────────────────────

def populate_from_existing_apartment(analysis, apartment):
    analysis.title = apartment.title or ''
    analysis.price = apartment.price
    analysis.area = apartment.area
    analysis.living_area = apartment.living_area
    analysis.kitchen_area = apartment.kitchen_area
    analysis.rooms = apartment.rooms
    analysis.floor = apartment.floor
    analysis.total_floors = apartment.total_floors
    analysis.address = apartment.address or ''
    analysis.district = apartment.district or ''
    analysis.metro_station = apartment.metro_station or ''
    analysis.description = apartment.description or ''
    analysis.photos = apartment.photos or []
    analysis.building_type = apartment.building_type or ''
    analysis.has_balcony = apartment.has_balcony
    if apartment.building_year:
        analysis.rc_year_built = apartment.building_year
    if apartment.metro_distance:
        try:
            mins = int(re.search(r'(\d+)', apartment.metro_distance).group(1))
            analysis.metro_distance_min = mins
        except (AttributeError, ValueError):
            pass
    analysis.save()


def populate_from_url_stub(analysis):
    """Заглушка — в продакшене тут будет реальный парсинг через parser-service."""
    analysis.title = f'Квартира ({analysis.source_type})'
    analysis.price = Decimal('12500000')
    analysis.area = Decimal('54')
    analysis.living_area = Decimal('32')
    analysis.kitchen_area = Decimal('11')
    analysis.rooms = 2
    analysis.floor = 8
    analysis.total_floors = 17
    analysis.ceiling_height = Decimal('2.75')
    analysis.district = 'Западный'
    analysis.metro_station = 'Парк Победы'
    analysis.metro_distance_min = 10
    analysis.building_type = 'монолитно-кирпичный'
    analysis.rc_year_built = 2019
    analysis.rc_class = 'комфорт'
    analysis.rc_parking = True
    analysis.rc_closed_territory = True
    analysis.rc_playground = True
    analysis.has_balcony = True
    analysis.has_loggia = True
    analysis.bathroom_type = 'раздельный'
    analysis.renovation_type = 'евроремонт'
    analysis.has_passenger_elevator = True
    analysis.has_freight_elevator = True
    analysis.save()
