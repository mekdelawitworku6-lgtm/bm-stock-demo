import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Settings } from './entities/settings.entity';
import { UpdateSettingsDto, SettingsResponseDto } from './dto/settings.dto';
import { CACHE_KEYS } from '../../common/constants';
import { CacheService } from '@/shared/cache/cache.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Build the company scope for settings queries. When no company is provided
   * the global (platform) settings row is used.
   */
  private companyWhere(companyId?: string): FindOptionsWhere<Settings> {
    return companyId ? { companyId } : { companyId: IsNull() };
  }

  private cacheKey(companyId?: string): string {
    return this.cacheService.generateKey(CACHE_KEYS.SETTINGS, companyId || 'global');
  }

  /**
   * Get application settings for a company
   * Creates default settings if none exist
   */
  async getSettings(companyId?: string): Promise<SettingsResponseDto> {
    const cacheKey = this.cacheKey(companyId);

    // Try to get from cache
    const cached = await this.cacheService.get<SettingsResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit for settings');
      return cached;
    }

    let settings = await this.settingsRepository.findOne({
      where: this.companyWhere(companyId),
    });

    // Create default settings if none exist
    if (!settings) {
      this.logger.log('No settings found, creating default settings');
      settings = this.settingsRepository.create({ companyId: companyId ?? null });
      await this.settingsRepository.save(settings);
    }

    const result = this.mapToResponseDto(settings);

    // Cache the result for 10 minutes
    await this.cacheService.set(cacheKey, result, 600000);

    return result;
  }

  /**
   * Update application settings for a company
   */
  async updateSettings(
    updateSettingsDto: UpdateSettingsDto,
    companyId?: string,
  ): Promise<SettingsResponseDto> {
    let settings = await this.settingsRepository.findOne({
      where: this.companyWhere(companyId),
    });

    if (!settings) {
      // Create new settings if none exist
      settings = this.settingsRepository.create({
        ...updateSettingsDto,
        companyId: companyId ?? null,
      });
    } else {
      // Update existing settings
      Object.assign(settings, updateSettingsDto);
    }

    const updatedSettings = await this.settingsRepository.save(settings);

    // Invalidate cache
    await this.cacheService.del(this.cacheKey(companyId));

    this.logger.log('Settings updated successfully');

    return this.mapToResponseDto(updatedSettings);
  }

  /**
   * Reset settings to default values for a company
   */
  async resetSettings(companyId?: string): Promise<SettingsResponseDto> {
    // Delete existing settings for this scope
    await this.settingsRepository.delete(this.companyWhere(companyId));

    // Create new default settings
    const defaultSettings = this.settingsRepository.create({
      companyId: companyId ?? null,
    });
    const savedSettings = await this.settingsRepository.save(defaultSettings);

    // Invalidate cache
    await this.cacheService.del(this.cacheKey(companyId));

    this.logger.log('Settings reset to defaults');

    return this.mapToResponseDto(savedSettings);
  }

  /**
   * Get specific setting value by key
   */
  async getSettingValue<T = any>(key: keyof Settings, companyId?: string): Promise<T> {
    const settings = await this.getSettings(companyId);
    return settings[key] as T;
  }

  /**
   * Update specific setting value
   */
  async updateSettingValue(
    key: keyof Settings,
    value: any,
    companyId?: string,
  ): Promise<SettingsResponseDto> {
    const updateDto = { [key]: value } as UpdateSettingsDto;
    return this.updateSettings(updateDto, companyId);
  }

  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(featureKey: keyof Settings, companyId?: string): Promise<boolean> {
    const value = await this.getSettingValue<boolean>(featureKey, companyId);
    return Boolean(value);
  }

  /**
   * Map entity to response DTO
   */
  private mapToResponseDto(settings: Settings): SettingsResponseDto {
    const dto = new SettingsResponseDto();
    Object.assign(dto, settings);
    return dto;
  }
}
