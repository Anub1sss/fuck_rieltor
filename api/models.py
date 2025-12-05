from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone


class Source(models.TextChoices):
    CIAN = 'cian', 'Циан'
    AVITO = 'avito', 'Авито'
    YANDEX = 'yandex', 'Яндекс.Недвижимость'


class Apartment(models.Model):
    source = models.CharField(max_length=20, choices=Source.choices)
    external_id = models.CharField(max_length=255, db_index=True)
    url = models.URLField(max_length=500)
    
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    area = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    rooms = models.IntegerField(null=True, blank=True)
    floor = models.IntegerField(null=True, blank=True)
    total_floors = models.IntegerField(null=True, blank=True)
    
    building_year = models.IntegerField(null=True, blank=True)
    building_type = models.CharField(max_length=100, null=True, blank=True)  # панель, кирпич, монолит и т.д.
    living_area = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    kitchen_area = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    
    # Дополнительные характеристики
    deposit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # Залог
    commission = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # Комиссия
    utilities_included = models.BooleanField(default=False)  # ЖКУ включены
    rental_period = models.CharField(max_length=100, null=True, blank=True)  # Срок аренды
    metro_distance = models.CharField(max_length=100, null=True, blank=True)  # Время до метро
    metro_transport = models.CharField(max_length=50, null=True, blank=True)  # пешком/транспорт
    published_date = models.CharField(max_length=100, null=True, blank=True)  # Дата публикации
    
    district = models.CharField(max_length=200, null=True, blank=True)
    metro_station = models.CharField(max_length=200, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    
    description = models.TextField(null=True, blank=True)
    title = models.CharField(max_length=500, null=True, blank=True)
    
    contact_phone = models.CharField(max_length=50, null=True, blank=True)
    contact_name = models.CharField(max_length=200, null=True, blank=True)
    is_owner = models.BooleanField(default=True)
    no_commission = models.BooleanField(default=True)
    
    photos = models.JSONField(default=list, blank=True)
    infrastructure = models.JSONField(default=dict, blank=True)
    
    has_furniture = models.BooleanField(default=False)
    has_appliances = models.BooleanField(default=False)
    has_internet = models.BooleanField(default=False)
    has_parking = models.BooleanField(default=False)
    has_elevator = models.BooleanField(default=False)
    has_balcony = models.BooleanField(default=False)
    features = models.JSONField(default=list, blank=True)  # список удобств
    
    is_active = models.BooleanField(default=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    is_favorite = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    parsed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'apartments'
        unique_together = [['source', 'external_id']]
        indexes = [
            models.Index(fields=['source', 'external_id']),
            models.Index(fields=['is_active', 'created_at']),
            models.Index(fields=['price', 'area']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_source_display()} - {self.price}₽ - {self.address or self.district}"


class ParseTask(models.Model):
    source = models.CharField(max_length=20, choices=Source.choices)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Ожидает'),
            ('running', 'Выполняется'),
            ('completed', 'Завершена'),
            ('failed', 'Ошибка'),
        ],
        default='pending'
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    apartments_found = models.IntegerField(default=0)
    apartments_new = models.IntegerField(default=0)
    apartments_updated = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'parse_tasks'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.get_source_display()} - {self.get_status_display()} - {self.created_at}"


class ParseLog(models.Model):
    task = models.ForeignKey(ParseTask, on_delete=models.CASCADE, related_name='logs')
    level = models.CharField(
        max_length=10,
        choices=[
            ('DEBUG', 'Debug'),
            ('INFO', 'Info'),
            ('WARNING', 'Warning'),
            ('ERROR', 'Error'),
        ]
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'parse_logs'
        ordering = ['-created_at']

