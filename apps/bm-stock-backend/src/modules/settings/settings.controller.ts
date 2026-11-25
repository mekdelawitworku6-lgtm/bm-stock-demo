import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto, SettingsResponseDto } from './dto/settings.dto';
import { JwtAuthGuard, RolesGuard } from '@/common/guards';
import { Roles, CurrentUser } from '@/common/decorators';
import { UserRole } from '@/common/enums';
import { ResponseDto } from '@/common/dto';
import { User } from '../users/entities/user.entity';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get application settings' })
  @ApiResponse({
    status: 200,
    description: 'Settings retrieved successfully',
    type: SettingsResponseDto,
  })
  async getSettings(
    @CurrentUser() currentUser: User,
  ): Promise<ResponseDto<SettingsResponseDto>> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const companyId = (currentUser as any)?.companyId || currentUser?.company?.id;
    const settings = await this.settingsService.getSettings(isPlatformAdmin ? (companyId || undefined) : companyId);
    return {
      success: true,
      message: 'Settings retrieved successfully',
      data: settings,
    };
  }

  @Put()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update application settings' })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    type: SettingsResponseDto,
  })
  async updateSettings(
    @Body() updateSettingsDto: UpdateSettingsDto,
    @CurrentUser() currentUser: User,
  ): Promise<ResponseDto<SettingsResponseDto>> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const companyId = (currentUser as any)?.companyId || currentUser?.company?.id;
    if (!isPlatformAdmin && !companyId) {
      throw new BadRequestException('User must belong to a company to modify settings');
    }
    const settings = await this.settingsService.updateSettings(updateSettingsDto, companyId);
    return {
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    };
  }

  @Post('reset')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset settings to default values' })
  @ApiResponse({
    status: 200,
    description: 'Settings reset to defaults successfully',
    type: SettingsResponseDto,
  })
  async resetSettings(
    @CurrentUser() currentUser: User,
  ): Promise<ResponseDto<SettingsResponseDto>> {
    const isPlatformAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
    const companyId = (currentUser as any)?.companyId || currentUser?.company?.id;
    if (!isPlatformAdmin && !companyId) {
      throw new BadRequestException('User must belong to a company to reset settings');
    }
    const settings = await this.settingsService.resetSettings(companyId);
    return {
      success: true,
      message: 'Settings reset to defaults successfully',
      data: settings,
    };
  }
}
