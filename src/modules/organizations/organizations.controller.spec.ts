import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      // expect(OrganizationsController.findAll()).toBe('Hello World!');
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
