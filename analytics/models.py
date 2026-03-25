from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid


class FamilyProfile(models.Model):
    BUYER_TYPES = [
        ('single', 'Один человек'),
        ('couple', 'Пара'),
        ('family', 'Семья с детьми'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    buyer_type = models.CharField(max_length=20, choices=BUYER_TYPES, default='couple')

    husband_work_address = models.CharField(max_length=500, blank=True, default='')
    wife_work_address = models.CharField(max_length=500, blank=True, default='')

    has_children = models.BooleanField(default=False)
    children_school_address = models.CharField(max_length=500, blank=True, default='')
    children_kindergarten_address = models.CharField(max_length=500, blank=True, default='')

    has_car = models.BooleanField(default=False)
    has_pets = models.BooleanField(default=False)

    priority_transport = models.BooleanField(default=True)
    priority_ecology = models.BooleanField(default=True)
    priority_infrastructure = models.BooleanField(default=True)
    priority_safety = models.BooleanField(default=True)
    priority_quietness = models.BooleanField(default=True)

    max_commute_minutes = models.IntegerField(default=60, validators=[MinValueValidator(5), MaxValueValidator(180)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analytics_family_profiles'
        ordering = ['-created_at']


class ApartmentAnalysis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family_profile = models.ForeignKey(FamilyProfile, on_delete=models.CASCADE, related_name='analyses')
    source_url = models.URLField(max_length=1000)
    source_type = models.CharField(max_length=20, choices=[
        ('cian', 'Циан'), ('avito', 'Авито'),
        ('yandex', 'Яндекс.Недвижимость'), ('unknown', 'Неизвестно'),
    ])

    # === Основные данные ===
    title = models.CharField(max_length=500, blank=True, default='')
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    price_per_m2 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    area = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    living_area = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    kitchen_area = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    rooms = models.IntegerField(null=True, blank=True)
    floor = models.IntegerField(null=True, blank=True)
    total_floors = models.IntegerField(null=True, blank=True)
    ceiling_height = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    address = models.TextField(blank=True, default='')
    district = models.CharField(max_length=200, blank=True, default='')
    metro_station = models.CharField(max_length=200, blank=True, default='')
    metro_distance_min = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True, default='')
    photos = models.JSONField(default=list, blank=True)

    # === Квартира — конструктив ===
    has_balcony = models.BooleanField(null=True, blank=True)
    has_loggia = models.BooleanField(null=True, blank=True)
    bathroom_type = models.CharField(max_length=50, blank=True, default='')
    window_view = models.CharField(max_length=100, blank=True, default='')
    renovation_type = models.CharField(max_length=100, blank=True, default='')

    # === Дом / ЖК ===
    residential_complex = models.CharField(max_length=300, blank=True, default='')
    building_type = models.CharField(max_length=100, blank=True, default='')
    building_series = models.CharField(max_length=100, blank=True, default='')
    rc_year_built = models.IntegerField(null=True, blank=True)
    rc_developer = models.CharField(max_length=300, blank=True, default='')
    rc_class = models.CharField(max_length=50, blank=True, default='')
    rc_features = models.JSONField(default=list, blank=True)
    rc_parking = models.BooleanField(default=False)
    rc_underground_parking = models.BooleanField(default=False)
    rc_concierge = models.BooleanField(default=False)
    rc_playground = models.BooleanField(default=False)
    rc_closed_territory = models.BooleanField(default=False)
    rc_sports_ground = models.BooleanField(default=False)
    rc_dog_walking = models.BooleanField(default=False)

    # === Подъезд ===
    apartments_per_floor = models.IntegerField(null=True, blank=True)
    has_freight_elevator = models.BooleanField(null=True, blank=True)
    has_passenger_elevator = models.BooleanField(null=True, blank=True)
    has_garbage_chute = models.BooleanField(null=True, blank=True)
    entrance_condition = models.CharField(max_length=100, blank=True, default='')

    # === Скоринг (0-100 по каждой категории) ===
    score_total = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    score_transport = models.IntegerField(default=0)
    score_ecology = models.IntegerField(default=0)
    score_infrastructure = models.IntegerField(default=0)
    score_safety = models.IntegerField(default=0)
    score_price_quality = models.IntegerField(default=0)
    score_building = models.IntegerField(default=0)
    score_floor = models.IntegerField(default=0)
    score_apartment_layout = models.IntegerField(default=0)
    score_district_perspective = models.IntegerField(default=0)
    score_quietness = models.IntegerField(default=0)
    score_social_infra = models.IntegerField(default=0)
    score_daily_comfort = models.IntegerField(default=0)

    # === Транспорт ===
    commute_husband_min = models.IntegerField(null=True, blank=True)
    commute_wife_min = models.IntegerField(null=True, blank=True)
    commute_school_min = models.IntegerField(null=True, blank=True)
    commute_kindergarten_min = models.IntegerField(null=True, blank=True)
    nearby_metro_stations = models.JSONField(default=list, blank=True)
    has_mcd = models.BooleanField(default=False)
    has_mck = models.BooleanField(default=False)
    bus_routes_nearby = models.IntegerField(null=True, blank=True)

    # === Инфраструктура ===
    nearby_schools = models.JSONField(default=list, blank=True)
    nearby_kindergartens = models.JSONField(default=list, blank=True)
    nearby_clinics = models.JSONField(default=list, blank=True)
    nearby_shops = models.JSONField(default=list, blank=True)
    nearby_malls = models.JSONField(default=list, blank=True)
    nearby_parks = models.JSONField(default=list, blank=True)
    nearby_fitness = models.JSONField(default=list, blank=True)
    nearby_pharmacies = models.JSONField(default=list, blank=True)
    schools_total_in_district = models.IntegerField(null=True, blank=True)
    kindergartens_total_in_district = models.IntegerField(null=True, blank=True)

    # === Окружение ===
    near_highway = models.BooleanField(default=False)
    near_railway = models.BooleanField(default=False)
    near_industrial_zone = models.BooleanField(default=False)
    near_airport_noise = models.BooleanField(default=False)
    noise_level = models.CharField(max_length=50, blank=True, default='')

    # === Район ===
    district_avg_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    district_price_trend = models.CharField(max_length=20, blank=True, default='')
    district_perspective = models.TextField(blank=True, default='')
    district_crime_level = models.CharField(max_length=50, blank=True, default='')

    # === Результат ===
    advantages = models.JSONField(default=list, blank=True)
    disadvantages = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    explanations = models.JSONField(default=dict, blank=True)
    recommendation = models.TextField(blank=True, default='')
    similar_apartments = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=20, default='pending', choices=[
        ('pending', 'В очереди'), ('analyzing', 'Анализируется'),
        ('done', 'Готово'), ('error', 'Ошибка'),
    ])
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    analyzed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'analytics_apartment_analyses'
        ordering = ['-created_at']
