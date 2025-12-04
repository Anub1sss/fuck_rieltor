from rest_framework import serializers
from .models import Apartment, ParseTask, Source


class ApartmentSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    
    class Meta:
        model = Apartment
        fields = [
            'id', 'source', 'source_display', 'external_id', 'url',
            'price', 'area', 'rooms', 'floor', 'total_floors',
            'building_year', 'building_type', 'living_area', 'kitchen_area',
            'district', 'metro_station', 'address',
            'description', 'title',
            'contact_phone', 'contact_name', 'is_owner', 'no_commission',
            'photos', 'infrastructure', 'features',
            'has_furniture', 'has_appliances', 'has_internet', 
            'has_parking', 'has_elevator', 'has_balcony',
            'is_active', 'is_verified', 'is_favorite',
            'created_at', 'updated_at', 'parsed_at', 'expires_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ApartmentListSerializer(serializers.ModelSerializer):
    """Упрощенный сериализатор для списка"""
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    
    class Meta:
        model = Apartment
        fields = [
            'id', 'source', 'source_display', 'url',
            'price', 'area', 'rooms', 'floor', 'total_floors',
            'district', 'metro_station', 'address',
            'title', 'photos',
            'is_verified', 'is_favorite',
            'created_at',
        ]


class ParseTaskSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ParseTask
        fields = [
            'id', 'source', 'source_display', 'status', 'status_display',
            'started_at', 'completed_at',
            'apartments_found', 'apartments_new', 'apartments_updated',
            'error_message', 'created_at',
        ]



