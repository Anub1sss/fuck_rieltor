from django.contrib import admin
from .models import Apartment, ParseTask, ParseLog


@admin.register(Apartment)
class ApartmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'source', 'price', 'area', 'rooms', 'district', 'metro_station', 'is_active', 'is_verified', 'created_at']
    list_filter = ['source', 'is_active', 'is_verified', 'is_owner', 'no_commission', 'rooms']
    search_fields = ['address', 'district', 'metro_station', 'external_id', 'title']
    readonly_fields = ['created_at', 'updated_at', 'parsed_at']
    list_editable = ['is_active', 'is_verified']


@admin.register(ParseTask)
class ParseTaskAdmin(admin.ModelAdmin):
    list_display = ['id', 'source', 'status', 'apartments_found', 'apartments_new', 'apartments_updated', 'created_at']
    list_filter = ['source', 'status', 'created_at']
    readonly_fields = ['created_at', 'started_at', 'completed_at']


@admin.register(ParseLog)
class ParseLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'task', 'level', 'message', 'created_at']
    list_filter = ['level', 'created_at']
    readonly_fields = ['created_at']
    search_fields = ['message']






