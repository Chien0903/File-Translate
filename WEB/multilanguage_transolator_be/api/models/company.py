from django.db import models


class Company(models.Model):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=100, unique=True)  # 'company-vn', 'company-jp'
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "companies"
        ordering = ['name']

    def __str__(self):
        return self.name
