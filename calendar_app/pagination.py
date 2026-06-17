from rest_framework.pagination import PageNumberPagination


class FlexiblePageNumberPagination(PageNumberPagination):
    """Respects the `page_size` query parameter up to a max of 1000."""

    page_size_query_param = "page_size"
    max_page_size = 1000
