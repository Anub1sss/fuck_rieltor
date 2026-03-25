from rest_framework import serializers
from .models import FamilyProfile, ApartmentAnalysis


class FamilyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyProfile
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class AnalysisRequestSerializer(serializers.Serializer):
    source_url = serializers.URLField()
    buyer_type = serializers.ChoiceField(choices=['single', 'couple', 'family'], required=False, default='couple')
    husband_work_address = serializers.CharField(required=False, allow_blank=True, default='')
    wife_work_address = serializers.CharField(required=False, allow_blank=True, default='')
    has_children = serializers.BooleanField(required=False, default=False)
    children_school_address = serializers.CharField(required=False, allow_blank=True, default='')
    children_kindergarten_address = serializers.CharField(required=False, allow_blank=True, default='')
    has_car = serializers.BooleanField(required=False, default=False)
    has_pets = serializers.BooleanField(required=False, default=False)
    priority_transport = serializers.BooleanField(required=False, default=True)
    priority_ecology = serializers.BooleanField(required=False, default=True)
    priority_infrastructure = serializers.BooleanField(required=False, default=True)
    priority_safety = serializers.BooleanField(required=False, default=True)
    priority_quietness = serializers.BooleanField(required=False, default=True)
    max_commute_minutes = serializers.IntegerField(required=False, default=60)


class ApartmentAnalysisListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApartmentAnalysis
        fields = [
            'id', 'source_url', 'source_type', 'title', 'price', 'area',
            'rooms', 'address', 'metro_station', 'score_total', 'status', 'created_at',
        ]


class ApartmentAnalysisDetailSerializer(serializers.ModelSerializer):
    family_profile = FamilyProfileSerializer(read_only=True)

    class Meta:
        model = ApartmentAnalysis
        fields = '__all__'
