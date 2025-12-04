from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from api.models import Apartment, Source
from django.utils import timezone
from parser.tasks import update_apartments_from_parser


@csrf_exempt
@require_http_methods(["GET"])
def parser_root(request):
    return JsonResponse({
        'message': 'Parser API',
        'endpoints': {
            'update-apartments': '/api/parser/update-apartments/',
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def update_apartments(request):
    try:
        data = json.loads(request.body)
        source = data.get('source')
        apartments_data = data.get('apartments', [])
        
        if source not in Source.values:
            return JsonResponse({'error': 'Invalid source'}, status=400)
        
        result = update_apartments_from_parser(source, apartments_data)
        
        return JsonResponse({
            'new': result.get('new', 0),
            'updated': result.get('updated', 0),
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

